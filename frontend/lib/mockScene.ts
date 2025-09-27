import { Faker, en } from "@faker-js/faker";

export type SceneConfig = {
  category: string;
  lengthSec: number;
  seed: number;
};

export function getMockCategories(count = 15, seed = 123): string[] {
  const rand = new Faker({ locale: [en] });
  rand.seed(seed);
  const categories = new Set<string>();
  while (categories.size < count) {
    categories.add(rand.commerce.department());
  }
  return Array.from(categories);
}

export function deriveSeedFromConfig(
  category: string,
  lengthSec: number
): number {
  // Simple deterministic hash -> 32-bit unsigned
  let hash = 2166136261;
  const input = `${category}|${lengthSec}`;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function toSceneConfig(
  category: string,
  lengthSec: number
): SceneConfig {
  const seed = deriveSeedFromConfig(category, lengthSec);
  return { category, lengthSec, seed };
}
