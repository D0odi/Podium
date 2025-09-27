import { en, faker, Faker } from "@faker-js/faker";

export type Bot = {
  id: string;
  name: string;
  avatar: string; // emoji for now
};

const emojiPalette = [
  "😀",
  "🙂",
  "😎",
  "🤔",
  "👏",
  "🤖",
  "🧠",
  "🧐",
  "🤓",
  "🧑‍💻",
];

export function generateBot(rand: typeof faker = faker): Bot {
  return {
    id: rand.string.uuid(),
    name: rand.person.firstName(),
    avatar: rand.helpers.arrayElement(emojiPalette),
  };
}

export function seedBots(min: number, max: number, seed?: number): Bot[] {
  const rand = seed !== undefined ? new Faker({ locale: [en] }) : faker;
  if (seed !== undefined) rand.seed(seed);
  const count = rand.number.int({ min, max });
  return Array.from({ length: count }, () => generateBot(rand));
}

export type Reaction = {
  emoji: string;
  phrase: string; // ≤ 3 words
  intensity: number; // -2..+2
};

const reactionEmojis = ["👍", "👏", "🧐", "🤔", "🔥", "✅", "❓", "💡", "😬"];
const phrases = [
  "nice point",
  "needs detail",
  "love it",
  "why now?",
  "too vague",
  "sounds risky",
  "great pace",
  "clear ask",
  "bold claim",
];

export function generateReaction(): Reaction {
  const sign = faker.number.int({ min: -2, max: 2 });
  return {
    phrase: faker.helpers.arrayElement(phrases),
    emoji: faker.helpers.arrayElement(reactionEmojis),
    intensity: sign,
  };
}
