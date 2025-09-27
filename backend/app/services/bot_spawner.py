import os
import json
import random
from typing import List, Dict, Optional
from openai import AsyncOpenAI, APIError
from openai.types.chat import ChatCompletionMessageParam
from .bot import Bot, BotPersona, BotState

async def _call_openai_api(messages: List[ChatCompletionMessageParam], timeout: int = 30) -> Optional[str]:
    if not os.getenv('OPENAI_API_KEY'):
        print("❌ ERROR: OPENAI_API_KEY environment variable not set.")
        return None
        
    client = AsyncOpenAI()
    try:
        response = await client.chat.completions.create(
            model="gpt-5-nano-2025-08-07",
            messages=messages,
            response_format={"type": "json_object"},
            temperature=1,
            timeout=timeout
        )
        return response.choices[0].message.content
        
    except (APIError, KeyError, IndexError) as e:
        print(f"Failed to extract content from API response: {e}")
        return None

AVATAR_EMOJIS = [
    "😀","🙂","😎","🤔","👏","🤖","🧠","🧐","🤓","🧑‍💻",
    "😄","😌","🤝","💡","🔥","👍","✨","🤯","😬","🫡"
]

ALLOWED_STANCES = ["supportive", "skeptical", "curious"]
ALLOWED_DOMAINS = ["tech", "design", "finance"]

async def generatePersonaPool(topic: str = "Public Speaking") -> Dict:
    prompt = f"""
    Generate a single persona object for a presentation on "{topic}".
    Your response MUST be a single, valid JSON object containing exactly the following keys:
    - "name": string
    - "stance": string (must be one of "supportive", "skeptical", or "curious")
    - "domain": string (must be one of "tech", "design", or "finance")
    - "snark": float (a JSON number between 0.0 and 1.0)
    - "politeness": float (a JSON number between 0.0 and 1.0)
    Do not include any additional text before or after the JSON object.
    """

    messages: List[ChatCompletionMessageParam] = [
        {"role": "user", "content": prompt}
    ]

    contentString = await _call_openai_api(messages)

    if contentString:
        try:
            persona = json.loads(contentString)
            if isinstance(persona, dict):
                # Randomize stance/domain to increase diversity
                persona["stance"] = random.choice(ALLOWED_STANCES)
                persona["domain"] = random.choice(ALLOWED_DOMAINS)
                return persona
            print("⚠️ The API response is not a valid JSON object.")
        except json.JSONDecodeError as e:
            print(f"Failed to parse persona JSON: {e}")

    # Fallback if the API response is not valid
    print("⚠️ Using fallback persona data.")
    # Fallback with random personality
    return {
        "name": "Engaged Student",
        "stance": random.choice(ALLOWED_STANCES),
        "domain": random.choice(ALLOWED_DOMAINS),
        "snark": round(random.uniform(0.0, 1.0), 2),
        "politeness": round(random.uniform(0.0, 1.0), 2),
    }


def createBotFromPool(persona_pool: dict) -> Optional[Bot]:
    if not persona_pool:
        return None
    try:
        persona = BotPersona(**persona_pool)
        state = BotState()
        return Bot(personality=persona, state=state)
    except Exception as e:
        print(f"Error creating bot from pool: {e}")
        return None