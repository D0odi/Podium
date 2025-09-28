import os
import json
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

def get_coach_feedback(transcript: str):
    if not OPENROUTER_API_KEY:
        print("OPENROUTER_API_KEY not set")
        return {}

    client = OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=OPENROUTER_API_KEY,
    )

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
        
        You do not have external Deepgram analysis. Infer approximate metrics (wpm, speechDuration, fillerWords) heuristically from the transcript length and common filler patterns ("um", "uh", "like"). Be reasonable, not extreme.

        **Your Task:**
        Return a single JSON object with two main keys: "upsides" and "shortcomings".
        - The "upsides" object must contain exactly three distinct strengths of the speech.
        - The "shortcomings" object must contain exactly three distinct, actionable areas for improvement.
        - Base your feedback on both the transcript content and deep analysis.
        - Keep the feedback concise, professional, and encouraging.
        - The root of the JSON should have keys: "wpm", "speechDuration", "fillerWords", "upsides", and "shortcomings".
        - Base your feedback on all provided data.

        **Required JSON Format:**
        ```json
        {{
        "wpm": 0,
        "speechDuration": 0,
        "fillerWords": 0,
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

    completion = client.chat.completions.create(
        model="openai/gpt-4o-mini",
        messages=[
            {"role": "system", "content": systemPrompt},
            {"role": "user", "content": userPrompt},
        ],
        response_format={"type": "json_object"},
    )

    rawResponse = completion.choices[0].message.content
    return json.loads(rawResponse)