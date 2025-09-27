import os
import json
import uuid
from typing import List, Dict, Optional
from pydantic import BaseModel, Field
from openai import AsyncOpenAI, APIError
from openai.types.chat import ChatCompletionMessageParam

class CoachPersona(BaseModel):
    name: str = "MegaKnight Coach"
    expertise: str = "presentation_coaching"
    feedback_style: str = "constructive"
    coaching_focus: List[str] = Field(default_factory=lambda: ["clarity", "structure", "engagement", "delivery"])
    experience_level: str = "expert"

class CoachState(BaseModel):
    full_transcript: str = ""
    session_metrics: Dict = Field(default_factory=dict)

class MegaKnight(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    persona: CoachPersona
    state: CoachState
    
    async def _call_openai_api(self, messages: List[ChatCompletionMessageParam], timeout: int = 45) -> Optional[Dict]:
        if not os.getenv('OPENAI_API_KEY'):
            print(f"❌ ERROR: OPENAI_API_KEY not set for coach {self.id}")
            return None
        
        client = AsyncOpenAI()
        try:
            response = await client.chat.completions.create(
                model="gpt-5-nano-2025-08-07",
                messages=messages,
                response_format={"type": "json_object"},
                temperature=1.0,
                timeout=timeout
            )
            content_string = response.choices[0].message.content
            return json.loads(content_string) if content_string else None
            
        except (APIError, KeyError, IndexError, json.JSONDecodeError) as e:
            print(f"Coach API request failed or failed to parse: {e}")
            return None

    async def generate_end_session_feedback(self) -> Optional[Dict]:
        user_prompt = f"""
        As an expert public speaking coach, provide comprehensive end-of-session feedback based on the full session.
        Transcript: {self.state.full_transcript}
        Metrics: {json.dumps(self.state.session_metrics, indent=2)}
        Return a JSON object with keys: "overall_rating"(int: 1-10), "summary"(str), "strengths"(list[str]), "improvements"(list[str]), and "next_steps"(list[str]).
        """
        messages: List[ChatCompletionMessageParam] = [{"role": "user", "content": user_prompt}]
        return await self._call_openai_api(messages)

    def accumulate_transcript(self, new_transcript_chunk: str):
        self.state.full_transcript = f"{self.state.full_transcript} {new_transcript_chunk}".strip()

    def update_session_metrics(self, metrics: Dict):
        self.state.session_metrics.update(metrics)

def create_megaknight_coach() -> MegaKnight:
    persona = CoachPersona()
    state = CoachState()
    return MegaKnight(persona=persona, state=state)