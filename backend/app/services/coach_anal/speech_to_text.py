import os

from deepgram import (
    DeepgramClient,
    PrerecordedOptions,
    FileSource,
)



def convert_speech(audio_path, deepgram_api) :
    try:
        deepgram = DeepgramClient(deepgram_api)

        with open(audio_path, "rb") as file:
            buffer_data = file.read()

        payload: FileSource = {
            "buffer": buffer_data,
        }

        options = PrerecordedOptions(
            model="nova-3",
            smart_format=True,
            filler_words=True,
            utterances=True,
            utt_split=1
        )

        response = deepgram.listen.rest.v("1").transcribe_file(payload, options)

        return response

    except Exception as e:
        print(f"Exception: {e}")



