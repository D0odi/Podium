import os
import json
import uuid
from typing import List, Tuple, Literal
from pydantic import BaseModel, Field
from openai import OpenAI, APIError
from openai.types.chat import ChatCompletionMessageParam

# OpenRouter configuration (inline constants per user request)
OPENROUTER_API_KEY = "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"
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"

class BotPersona(BaseModel):
    name: str
    stance: Literal["supportive", "skeptical", "curious"]
    domain: Literal["tech", "design", "finance"]
    snark: float
    politeness: float

class BotState(BaseModel):
    engagementScore: float = 10.0
    present: bool = True
    memory: List[str] = Field(default_factory=list)
    engagementHistory: List[Tuple[float, float]] = Field(default_factory=list)
    lastReactionTs: float = 0.0
    cooldownSeconds: float = 3.0
    reactionProbability: float = 1 # 100% chance to react per flushed chunk
    recentEmojis: List[str] = Field(default_factory=list)
    recentPhrases: List[str] = Field(default_factory=list)

def create_system_prompt(bot):
    return f"""You are an audience member with stance: {bot.personality.stance}, domain: {bot.personality.domain}.

React to the speech with a JSON object containing:
- "emoji_unicode": an emoji glyph (like "🙂")
- "micro_phrase": short phrase (max 3 words)
- "score_delta": number from -5 to +5

Example: {{"emoji_unicode": "🙂", "micro_phrase": "Interesting", "score_delta": 1}}"""

# Reuse one async OpenAI client per process to reduce connection/setup overhead
_shared_client: OpenAI | None = None


def get_client() -> OpenAI:
    global _shared_client
    if _shared_client is None:
        _shared_client = OpenAI(
            base_url=OPENROUTER_BASE_URL,
            api_key=OPENROUTER_API_KEY,
        )
    return _shared_client


class Bot(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    avatar: str = Field(default="🤖")
    personality: BotPersona
    state: BotState

    async def generateReaction(self, transcript_chunk: str):

        client = get_client()
        system_prompt = create_system_prompt(self)
        
        messages: List[ChatCompletionMessageParam] = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": transcript_chunk}
        ]

        try:
            response = client.chat.completions.create(
                model='mistralai/ministral-8b', # 'inception/mercury-coder' lowest throughoutput, # 'mistralai/ministral-8b' lowest latency, # 'x-ai/grok-code-fast-1',
                messages=messages,
                response_format={"type": "json_object"},
                temperature=1,
                max_tokens=60
            )
            
            content_string = response.choices[0].message.content
            if not content_string:
                return None
            
            return json.loads(content_string)

        except (APIError, KeyError, IndexError, json.JSONDecodeError) as e:
            print(f"[bot] Failed to get reaction for bot={self.id}: {e}")
            return None