from speech_to_text import convert_speech
from analyze_text import analyze
from util import calculateLongPauseRatio
from coach import coach_result
import os
import json
from dotenv import load_dotenv


load_dotenv() 

AUDIO_FILE = "lev_megaum.wav"
DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY")
OPENAI_API_KEY = os.getenv("OPENROUTER_API_KEY")

def main():
    transcribed_text_json = convert_speech(AUDIO_FILE, DEEPGRAM_API_KEY)
    #print (type(transcribed_text_json))
    #print(transcribed_text_json.to_json(indent = 4))

    #print(calculateLongPauseRatio(transcribed_text_json))


    transcribed_text =  transcribed_text_json['results']['channels'][0]['alternatives'][0]['transcript']
    #print(f"\n\n{transcribed_text}\n\n")

    analysis_response = analyze(transcribed_text, DEEPGRAM_API_KEY)

    #print(json.dumps(analysis_response, indent = 4))

    print(transcribed_text)
    print(coach_result(OPENAI_API_KEY, transcribed_text, analysis_response, calculateLongPauseRatio(transcribed_text_json)))

