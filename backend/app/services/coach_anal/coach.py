
import json
import google.generativeai as genai
import os
from dotenv import load_dotenv
from .util import (
    calculateMinMaxWpm,
    calculateWpm,
    countFillerWords,
    calculateLongPauseRatio,
)
from .analyze_text import analyze

load_dotenv() 

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

# USE 2.5 flash lite
MODEL_NAME = "gemini-2.5-pro"


def get_client():
    genai.configure(api_key=GOOGLE_API_KEY)
    return genai.GenerativeModel(MODEL_NAME)




def coach_result(transcript, deep_analysis, dg_response, stutters, wpm, speech_duration, filler_words, target_goal_seconds: int | None = None):
    client = get_client()

    systemPrompt = """
        You are an expert public speaking coach named 'Madick'. Your goal is to provide clear, 
        constructive, and encouraging feedback to help users improve their speaking skills. 
        You will always respond in a structured JSON format.
        Consider the fact that sometimes the user stutters so some words may appear twice in a row in the transcript
        """

    userPrompt = f"""
        Analyze the following speech transcript and its corresponding fluency analysis. Based on this data, provide feedback.

        **Speech Transcript:**
        "{transcript}"
        
        **Deep analysis**
        {deep_analysis}

        **Fluency Analysis:**
        - Percentage of long pauses: {stutters}%

        **Your Task:**
        Return a single JSON object with two main keys: "upsides" and "shortcomings".
        - The "upsides" object must contain exactly three distinct strengths of the speech.
        - The "shortcomings" object must contain exactly three distinct, actionable areas for improvement.
        - Base your feedback on both the transcript content, deep analysis, and the fluency analysis data.
        - Keep the feedback concise, professional, and encouraging.
        - The root of the JSON should have keys: "wpm", "speechDuration", "fillerWords", "upsides", and "shortcomings".
        - Base your feedback on all provided data.
        - Upsides and shortcomings should be clear and concise

        **Required JSON Format:**
        ```json
        {{
        "wpm": {wpm},
        "speechDuration": {speech_duration:.2f},
        "fillerWords": {filler_words},
        "upsides": {{
            "strengthOne": "Description of the first strength.",
            "strengthTwo": "Description of the second strength.",
            "strengthThree": "Description of the third strength."
        }},
        "shortcomings": {{
            "areaOne": "Description of the first area for improvement.",
            "areaTwo": "Description of the second area for improvement.",
            "areaThree": "Description of the third area for improvement."
        }}
        }}
        ```
        """



    # Gemini v1beta only supports roles "user" and "model". We'll embed the system
    # instructions inside the user prompt to avoid a 400 error.
    full_prompt = f"{systemPrompt}\n\n{userPrompt}"

    # ---------------- New requirement ----------------
    # Instead of calling the LLM, we compute and return the metrics locally.
    total_words = len(transcript.split()) if transcript else 0
    filler_count = filler_words
    filler_percent = round((filler_count / total_words) * 100, 1) if total_words else 0.0

    # Duration goal – prefer caller-provided goal, fallback to 2 minutes
    goal_seconds = int(target_goal_seconds) if target_goal_seconds else 120
    actual_seconds = int(speech_duration)
    deviation_seconds = actual_seconds - goal_seconds

    def _fmt(sec: int) -> str:
        minutes = sec // 60
        seconds = sec % 60
        return f"{minutes}:{seconds:02d}"

    min_wpm, max_wpm = calculateMinMaxWpm(dg_response)
    avg_wpm = wpm if wpm else round((min_wpm + max_wpm) / 2)
    optimal_min, optimal_max = 130, 170

    if avg_wpm < optimal_min - 20:
        status = "slow"
    elif avg_wpm < optimal_min:
        status = "slightly_slow"
    elif avg_wpm <= optimal_max:
        status = "optimal"
    elif avg_wpm <= optimal_max + 20:
        status = "slightly_fast"
    else:
        status = "fast"

    # Topics extracted from deep_analysis if provided (Deepgram Read returns topics list)
    topics = []
    try:
        topics = deep_analysis.get("topics", []) if isinstance(deep_analysis, dict) else []
    except Exception:
        topics = []

    upsides: list[str] = []
    shortcomings: list[str] = []

    # Upside/shortcoming rules
    if filler_percent < 1:
        upsides.append("Excellent control over filler words – you sound polished and confident.")
    else:
        shortcomings.append("Aim to further reduce filler words like 'um', 'uh', and 'like' for a smoother delivery.")

    if status == "optimal":
        upsides.append("Great pacing – your speech rate is within the ideal range, making it easy to follow.")
    elif status in ("slightly_slow", "slightly_fast"):
        shortcomings.append("Your pacing is close to optimal; a small adjustment will make it perfect.")
    else:
        shortcomings.append("Work on your pacing – try to keep within the (130–170 WPM) range for clarity.")

    if abs(deviation_seconds) < 10:
        upsides.append("You met your time goal – well-planned content!")
    elif deviation_seconds > 0:
        shortcomings.append("Consider trimming content to finish closer to the time goal.")
    else:
        shortcomings.append("You finished well under the goal; you could elaborate a bit more next time.")

    # Ask Gemini to generate upsides/shortcomings/topics
    prompt_for_gemini = (
        "You are a supportive public-speaking coach. Read the transcript provided and, in an encouraging tone, "
        "list exactly three strengths (upsides) and three concrete areas to improve (shortcomings). Upsides and shortcomings need to be clear and concise (1 - 2 medium length sentences )) "
        "Also list the main topics detected. Return ONLY valid JSON with keys 'upsides', 'shortcomings', 'topics'.\n\n"
        f"TRANSCRIPT:\n{transcript[:8000]}"  # truncate to 8k chars for safety
    )

    try:
        gemini_resp = client.generate_content(
            prompt_for_gemini,
            generation_config={"response_mime_type": "application/json"},
        )
        gemini_json = json.loads(gemini_resp.text)
        upsides = gemini_json.get("upsides", upsides)
        shortcomings = gemini_json.get("shortcomings", shortcomings)
        topics = gemini_json.get("topics", topics)
    except Exception:
        # fall back to earlier deterministic lists
        default_up = "Strong, engaging delivery throughout your speech."
        default_down = "Continue practising to enhance vocal variety and emphasis."
        while len(upsides) < 3:
            upsides.append(default_up)
        upsides = upsides[:3]
        while len(shortcomings) < 3:
            shortcomings.append(default_down)
        shortcomings = shortcomings[:3]

    result = {
        "fillerWords": {
            "totalWords": total_words,
            "fillerCount": filler_count,
            "fillerPercent": filler_percent,
        },
        "durationVsGoal": {
            "actualSeconds": actual_seconds,
            "goalSeconds": goal_seconds,
            "deviationSeconds": deviation_seconds,
            "actualFormatted": _fmt(actual_seconds),
            "goalFormatted": _fmt(goal_seconds),
        },
        "speechRate": {
            "avgWpm": avg_wpm,
            "minWpm": min_wpm,
            "maxWpm": max_wpm,
            "optimalRange": {"min": optimal_min, "max": optimal_max},
            "status": status,
        },
        "upsides": upsides,
        "shortcomings": shortcomings,
        "topics": topics,
    }

    return result


def get_coach_feedback(
    transcript: str,
    target_goal_seconds: int | None = None,
    *,
    speech_duration: int | None = None,
    dg_response: dict | None = None,
) -> dict:
    """Compute deep analysis and fluency metrics, then call coach_result.

    If a Deepgram transcript response is provided, metrics are computed using util.
    Otherwise, we fall back where possible (e.g., filler words from raw text, WPM from
    transcript length and provided speech_duration).
    """

    if not isinstance(transcript, str) or not transcript.strip():
        raise ValueError("transcript must be a non-empty string")

    deep_analysis = analyze(
        transcript,
        language="en",
        sentiment=True,
        intents=False,
        summarize=False,
        topics=True,
    )

    # Build minimal response wrapper when DG response isn't available for filler counts
    minimal_response = {
        "results": {"channels": [{"alternatives": [{"transcript": transcript}]}]},
        "metadata": {"duration": speech_duration or 0},
    }

    # Filler words
    filler_words = countFillerWords(dg_response or minimal_response)

    # Long pause ratio (stutters)
    try:
        stutters = calculateLongPauseRatio(dg_response) if dg_response else 0
    except Exception:
        stutters = 0

    # WPM
    wpm = 0
    if dg_response:
        try:
            wpm = calculateWpm(dg_response)
        except Exception:
            wpm = 0
    elif speech_duration and speech_duration > 0:
        try:
            total_words = len(transcript.split())
            wpm = round(total_words / (speech_duration / 60)) if total_words else 0
        except Exception:
            wpm = 0

    # Call core result function
    return coach_result(
        transcript,
        deep_analysis,
        dg_response or {},
        stutters,
        wpm,
        speech_duration or 0,
        filler_words,
        target_goal_seconds,
    )
