import os
import json
import random
from typing import List, Dict, Optional
from openai import APIError
from openai.types.chat import ChatCompletionMessageParam
from .bot import Bot, BotPersona, BotState, get_client

async def _call_openai_api(messages: List[ChatCompletionMessageParam], response_format: dict) -> Optional[str]:
    """Call OpenRouter via shared client from bot.py to generate personas with structured outputs."""
    try:
        client = get_client()
        response = client.chat.completions.create(
            model='x-ai/grok-code-fast-1',
            messages=messages,
            response_format=response_format,
            temperature=0.9,
            max_tokens=1200,
        )
        return response.choices[0].message.content
    except (APIError, KeyError, IndexError) as e:
        print(f"Failed to extract content from API response: {e}")
        return None

AVATAR_EMOJIS = [
    "😀", "🙂", "😎", "🤔", "🧐", "🤓", "😄", "😌", "🤯",
    "😬", "🫡", "😂", "😁", "😍", "😊", "😇", "🤩", "😐", "😏",
    "😒", "😕", "🤨", "🙄", "😮", "😜", "🥳", "🤠", "😴", "😑"
]

ALLOWED_STANCES = ["supportive", "skeptical", "curious"]
ALLOWED_DOMAINS = ["tech", "design", "finance"]

def _build_persona_pool_response_format(count: int) -> dict:
    return {
        "type": "json_schema",
        "json_schema": {
            "name": "persona_pool",
            "strict": True,
            "schema": {
                "type": "array",
                "minItems": count,
                "maxItems": count,
                "items": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string"},
                        "stance": {"type": "string", "enum": ALLOWED_STANCES},
                        "domain": {"type": "string", "enum": ALLOWED_DOMAINS},
                        "description": {"type": "string", "description": "Exactly 2 sentences"}
                    },
                    "required": ["name", "stance", "domain", "description"],
                    "additionalProperties": False
                }
            }
        }
    }

def _validate_persona(obj: dict) -> Optional[dict]:
    try:
        name = str(obj.get("name", "")).strip()
        stance = str(obj.get("stance", "")).strip()
        domain = str(obj.get("domain", "")).strip()
        description = str(obj.get("description", "")).strip()
        if not name or not description:
            return None
        if stance not in ALLOWED_STANCES:
            return None
        if domain not in ALLOWED_DOMAINS:
            return None
        # enforce two sentences heuristically
        if description.count('.') < 1:
            return None
        return {"name": name, "stance": stance, "domain": domain, "description": description}
    except Exception:
        return None

def _fallback_persona(i: int) -> dict:
    return {
        "name": f"Audience {i+1}",
        "stance": random.choice(ALLOWED_STANCES),
        "domain": random.choice(ALLOWED_DOMAINS),
        "description": "Engaged attendee with a distinct viewpoint. Offers concise, relevant reactions.",
    }

async def generatePersonaPool(topic: str, count: int) -> List[Dict]:
    prompt = f"""
    Generate a diverse pool of exactly {count} distinct audience persona objects for a presentation on "{topic}".

    Return a JSON array (and nothing else) with exactly {count} items.
    Each item MUST be an object with exactly these keys:
    - "name": string
    - "stance": string (one of "supportive", "skeptical", "curious")
    - "domain": string (one of "tech", "design", "finance")
    - "description": string (exactly 2 sentences)

    Diversity + realism requirements (must follow all):
    1) Familiarity mix:
    - Include people who are experts, some who are only broadly aware, and at least TWO who are unfamiliar with one or both sides of the topic.
    - Encode familiarity implicitly in the 2-sentence description (e.g., “has never used AWS,” “only knows Musk from headlines,” “deep experience with cloud infra,” etc.).

    2) Topical spread:
    - At most HALF of the personas may mention BOTH sides of the topic explicitly.
    - At least THREE personas should not name either side directly; they speak from adjacent or everyday perspectives (e.g., small business owner using SaaS, teacher who hears about tech from students, etc.).

    3) Domain variety (still using the allowed values):
    - Use a realistic spread across "tech", "design", and "finance" AND include perspectives that are only tangentially related to the topic (e.g., a designer focused on accessibility who doesn’t know AWS, a finance person who only tracks macro trends).
    - The description can reflect non-tech day jobs or interests even if the domain label remains one of the allowed values.

    4) Stance balance:
    - Mix "supportive", "skeptical", and "curious" so no single stance dominates. Assign stances independently from familiarity (e.g., an unfamiliar person can still be supportive or skeptical).

    5) Names and voices:
    - Use varied, realistic names and avoid overlaps. Keep the tone natural and specific; avoid boilerplate.

    Do not include any commentary before or after the JSON.

    """

    messages: List[ChatCompletionMessageParam] = [
        {"role": "user", "content": prompt}
    ]

    response_format = _build_persona_pool_response_format(count)
    contentString = await _call_openai_api(messages, response_format)

    personas: List[Dict] = []
    if contentString:
        try:
            data = json.loads(contentString)
            if isinstance(data, list):
                for item in data:
                    if not isinstance(item, dict):
                        continue
                    valid = _validate_persona(item)
                    if valid:
                        personas.append(valid)
            else:
                print("⚠️ Expected a JSON array for persona pool; got different type.")
        except json.JSONDecodeError as e:
            print(f"Failed to parse persona pool JSON: {e}")

    # Ensure we have exactly count items by trimming or filling with fallbacks
    if len(personas) < count:
        for i in range(len(personas), count):
            personas.append(_fallback_persona(i))
    elif len(personas) > count:
        personas = personas[:count]

    try:
        names = ", ".join([p.get("name", "?") for p in personas])
        print(f"[personas] generated pool count={len(personas)} topic='{topic}' names=[{names}]")
    except Exception:
        print(f"[personas] generated pool count={len(personas)} topic='{topic}'")

    return personas


# Note: Bot construction is now done directly in API routes using BotPersona/BotState.