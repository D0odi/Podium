import os

from deepgram import (
    DeepgramClient,
    PrerecordedOptions,
    FileSource,
)



def convert_speech(audio_path) :
    try:
        # Set a generous timeout (30 minutes) to handle long audio uploads & processing
        deepgram = DeepgramClient("47a26aa81e2ff513670139f160e1af2429c2812d")

        with open(audio_path, "rb") as file:
            payload: FileSource = {"buffer": file.read()}

        options = PrerecordedOptions(
            model="nova-3",
            smart_format=True,
            filler_words=True,
            utterances=True,
            utt_split=1,
        )

        # Direct synchronous call with extended timeout (seconds)
        response = deepgram.listen.prerecorded.v("1").transcribe_file(
            payload,
            options,
            timeout=1800,
        )

        return response

    except Exception as e:
        print(f"Exception: {e}")



