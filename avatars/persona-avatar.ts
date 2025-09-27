import { schema as coreSchema } from '@dicebear/core';
import { micah, avataaars } from '@dicebear/collection';
import { renderAvatarSVG } from './avatar';
import { avataaarsEmotionMap, Emotion } from './avatar-emotions';
import { micahEmotionOptions } from './micah-emotions';

type Persona = {
  id: string;                 // stable ID per bot
  style: 'micah' | 'avataaars';
  gender: 'male' | 'female';
  accessoriesProbability?: number; // 0..100
  facialHairProbability?: number;  // 0..100
};

const styleSchemas = {
  micah: { ...coreSchema.properties, ...micah.schema.properties },
  avataaars: { ...coreSchema.properties, ...avataaars.schema.properties },
};

export function renderPersonaAvatar(p: Persona, emotion: Emotion): string {
  const seed = `${p.id}:${emotion}`;

  if (p.style === 'avataaars') {
    const recipe = avataaarsEmotionMap[emotion];
    const opts = {
      ...p,
      eyes: recipe.eyes,
      eyebrows: recipe.eyebrows,
      mouth: recipe.mouth,
    };
    return renderAvatarSVG('avataaars', seed, opts);
  }

  const opts = {
    ...p,
    ...micahEmotionOptions(styleSchemas.micah as any, emotion),
  };

  return renderAvatarSVG('micah', seed, opts);
}