import requests

# Analyze Text (POST /v1/read)


def analyze (transcribed_text, DEEPGRAM_API_KEY):
    custom_topic = "Millionaires"

    params_url = str(f"https://api.deepgram.com/v1/read?custom_topic={custom_topic}&intents=true&language=en&sentiment=true&summarize=true&topics=true&custom_topic_mode=extended")

    response = requests.post(
    params_url,
    headers={
    "Authorization": f"Token {DEEPGRAM_API_KEY}"
    },
    json={
        "text": transcribed_text
    },
    )

    return response.json()