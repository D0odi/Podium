import json

def calculateLongPauseRatio(response, pauseThreshold=0.3):
    """
    Analyzes a Deepgram response to find the ratio of unusually long pauses.

    A pause is the duration of silence between two consecutive words. It is
    considered "long" if it exceeds the pauseThreshold.

    Args:
        response: The PrerecordedResponse object (as a dictionary) from Deepgram.
        pauseThreshold (float): The time in seconds to define a long pause.
                                Defaults to 0.8 seconds.

    Returns:
        float: The ratio of long pauses to the total number of pauses in the
               transcript (e.g., 0.15 for 15%). Returns 0.0 if there are
               fewer than two words.
    """
    try:
        words = response['results']['channels'][0]['alternatives'][0]['words']
    except (KeyError, IndexError):
        print("Warning: Could not find a word list in the response.")
        return 0.0

    if len(words) < 2:
        return 0.0

    longPauses = 0
    totalPauses = len(words) - 1

    # Iterate through the words to find the pause between each one
    for i in range(totalPauses):
        currentWord = words[i]
        nextWord = words[i+1]

        # The pause is the gap between the end of one word and the start of the next
        pauseDuration = nextWord['start'] - currentWord['end']

        if pauseDuration > pauseThreshold:
            longPauses += 1
    
    return longPauses / totalPauses