import json

def calculateWpm(response):
    """
    Calculates the words per minute (WPM) from a Deepgram transcript response.
    """
    try:
        durationInSeconds = response['metadata']['duration']
        words = response['results']['channels'][0]['alternatives'][0]['words']
        
        if durationInSeconds == 0:
            return 0
            
        wordCount = len(words)
        durationInMinutes = durationInSeconds / 60
        wpm = round(wordCount / durationInMinutes)
        
        return wpm
    except (KeyError, IndexError, ZeroDivisionError):
        return 0



def countFillerWords(response):
    """
    Counts the occurrences of common filler words in a Deepgram transcript.
    """
    # A list of common English filler words. You can expand this list.
    FILLER_WORDS = {
        "ah", "uh", "um", "hmm", "er", "like", "you know", 
        "so", "well", "basically", "actually", "literally", "okay"
    }
    
    try:
        transcript = response['results']['channels'][0]['alternatives'][0]['transcript']
        words = transcript.lower().split()
        
        fillerCount = 0
        for word in words:
            # Remove punctuation for accurate matching
            cleanedWord = word.strip(".,!?")
            if cleanedWord in FILLER_WORDS:
                fillerCount += 1
        
        return fillerCount
    except (KeyError, IndexError):
        return 0

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