import os
import json
import requests
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

def analyze_text(transcribed_text):
    if not DEEPGRAM_API_KEY:
        print("DEEPGRAM_API_KEY not set")
        return {}

    custom_topic = "Millionaires"
    params_url = str(f"https://api.deepgram.com/v1/read?custom_topic={custom_topic}&intents=true&language=en&sentiment=true&summarize=true&topics=true&custom_topic_mode=extended")

    response = requests.post(
        params_url,
        headers={"Authorization": f"Token {DEEPGRAM_API_KEY}"},
        json={"text": transcribed_text},
    )
    return response.json()

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

    deep_analysis = analyze_text(transcript)

    userPrompt = f"""
        Analyze the following speech transcript and its corresponding fluency analysis. Based on this data, provide feedback.

        **Speech Transcript:**
        "{transcript}"
        
        **Deep analysis**
        {deep_analysis}

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