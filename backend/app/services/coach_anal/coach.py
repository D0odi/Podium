from openai import OpenAI
import os



def coach_result(OPENAI_API_KEY, transcript, deep_analysis, stutters):
    client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=OPENAI_API_KEY,
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

        **Required JSON Format:**
        ```json
        {{
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

    return completion.choices[0].message.content
