from speech_to_text import convert_speech
from analyze_text import analyze
from util import calculateLongPauseRatio, calculateWpm, countFillerWords
from coach import coach_result
import os
import json
from dotenv import load_dotenv


load_dotenv() 
AUDIO_FILE = "C:\\Users\\imang\\sunhacks\\Podium\\backend\\app\\services\\coach_anal\\MLKDream.wav"
DEEPGRAM_API_KEY = "47a26aa81e2ff513670139f160e1af2429c2812d"

def anal():
    transcribed_text_json = convert_speech(AUDIO_FILE, DEEPGRAM_API_KEY)
    if not transcribed_text_json:
        raise RuntimeError("Deepgram transcription failed; check AUDIO_FILE and API key.")
    #print (type(transcribed_text_json))
    #print(transcribed_text_json.to_json(indent = 4))

    #print(calculateLongPauseRatio(transcribed_text_json))


    transcribed_text =  transcribed_text_json['results']['channels'][0]['alternatives'][0]['transcript']
    #print(f"\n\n{transcribed_text}\n\n")

    analysis_response = analyze(transcribed_text, DEEPGRAM_API_KEY)

    #print(json.dumps(analysis_response, indent = 4))

    print(transcribed_text)
    response_coach = coach_result(
        transcribed_text,
        analysis_response,
        transcribed_text_json,
        calculateLongPauseRatio(transcribed_text_json),
        calculateWpm(transcribed_text_json),
        transcribed_text_json['metadata']['duration'],
        countFillerWords(transcribed_text_json),
    )

    print(response_coach)



if __name__ == "__main__":
    anal()

