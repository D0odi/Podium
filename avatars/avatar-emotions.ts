export type Emotion =
  | 'happy'
  | 'excited'
  | 'calm'
  | 'attentive'
  | 'skeptical'
  | 'confused'
  | 'sad'
  | 'angry'
  | 'surprised'
  | 'bored';

export const avataaarsEmotionMap: Record<Emotion, Record<string, string[]>> = {
  happy: {
    eyes: ['happy', 'wink', 'winkWacky'],
    eyebrows: ['raisedExcited', 'raisedExcitedNatural','up'],
    mouth: ['smile'],
  },
  excited: {
    eyes: ['hearts', 'happy', 'surprised'],
    eyebrows: ['raisedExcited', 'raisedExcitedNatural'],
    mouth: ['smile', 'twinkle'],
  },
  calm: {
    eyes: ['default'],
    eyebrows: ['defaultNatural', 'flatNatural','default'],
    mouth: ['default', 'serious', 'smile'],
  },
  attentive: {
    eyes: ['surprised', 'default'],
    eyebrows: ['upDown', 'upDownNatural', 'defaultNatural','up'],
    mouth: ['serious', 'default'],
  },
  skeptical: {
    eyes: ['eyeRoll', 'side'],
    eyebrows: ['flatNatural', 'frownNatural'],
    mouth: ['disbelief', 'serious'],
  },
  confused: {
    eyes: ['xDizzy', 'eyeRoll', 'squint'],
    eyebrows: ['sadConcerned', 'sadConcernedNatural'],
    mouth: ['grimace', 'concerned'],
  },
  sad: {
    eyes: ['cry', 'closed', 'squint'],
    eyebrows: ['sadConcerned', 'sadConcernedNatural'],
    mouth: ['sad', 'concerned'],
  },
  angry: {
    eyes: ['squint', 'closed'],
    eyebrows: ['angryNatural', 'frownNatural', 'angry'],
    mouth: ['serious', 'grimace'],
  },
  surprised: {
    eyes: ['surprised', 'happy'],
    eyebrows: ['raisedExcited', 'raisedExcitedNatural'],
    mouth: ['screamOpen', 'disbelief'],
  },
  bored: {
    eyes: ['default', 'eyeRoll','closed'],
    eyebrows: ['flatNatural', 'defaultNatural','sadConcerned','sadConcernedNatural'],
    mouth: ['serious', 'default'],
  },
};