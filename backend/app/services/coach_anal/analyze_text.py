from typing import Dict, Any
import os
from dotenv import load_dotenv

from deepgram import DeepgramClient, AnalyzeOptions, TextSource

load_dotenv()

DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY")

def analyze(
    transcribed_text: str,
    *,
    language: str = "en",
    sentiment: bool = True,
    intents: bool = False,
    summarize: bool = False,
    topics: bool = False,
) -> Dict[str, Any]:
    """Run Deepgram text analysis using the official SDK.

    Parameters
    ----------
    transcribed_text : str
        Transcript text to analyse.
    deepgram_api_key : str
        Deepgram API key.
    language : str, optional
        Language code (default ``"en"``).
    sentiment, intents, summarize, topics : bool
        Feature flags passed to Deepgram AnalyzeOptions.

    Returns
    -------
    dict
        Deepgram JSON response as a dict.
    """

    if not transcribed_text:
        raise ValueError("transcribed_text must not be empty")

    dg_client = DeepgramClient(DEEPGRAM_API_KEY)

    payload: TextSource = {"buffer": transcribed_text}

    options = AnalyzeOptions(
        language=language,
        sentiment=sentiment,
        intents=intents,
        summarize=summarize,
        topics=topics,
    )

    response = dg_client.read.analyze.v("1").analyze_text(payload, options)

    return response.to_dict()
