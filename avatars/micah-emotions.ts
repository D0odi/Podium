import { micah } from '@dicebear/collection';
import type { Emotion } from './avatar-emotions';

function pickClosest(allowed: string[] = [], hints: string[]): string | undefined {
  const hay = allowed.map((v) => v.toLowerCase());
  for (const h of hints.map((x) => x.toLowerCase())) {
    const idx = hay.findIndex((v) => v.includes(h));
    if (idx >= 0) return allowed[idx];
  }
  return undefined;
}

export function micahEmotionOptions(
  styleOptionsFromSchema: Record<string, any>,
  emotion: Emotion
): Record<string, unknown> {
  const eyesVals = styleOptionsFromSchema?.eyes?.items?.enum as string[] | undefined;
  const browVals = styleOptionsFromSchema?.eyebrows?.items?.enum as string[] | undefined;
  const mouthVals = styleOptionsFromSchema?.mouth?.items?.enum as string[] | undefined;

  const byEmotion: Record<Emotion, { eyes: string[]; brows: string[]; mouth: string[] }> = {
    happy: { eyes: ['smiling', 'round', 'smilingShadow'], brows: ['up'], mouth: ['laughing', 'pucker'] },
    excited:{ eyes: ['eyes','round'], brows: ['up'], mouth: ['laughing','surprised','smile'] },
    calm:   { eyes: ['eyes','round'], brows: ['up'], mouth: ['smile'] },
    attentive:{ eyes: ['round','eyes'], brows: ['up'], mouth: ['smile','smirk'] },
    skeptical:{ eyes: ['eyeshadow','round'], brows: ['down'], mouth: ['serious','frown'] },
    confused:{ eyes: ['eyeshadow','round'], brows: ['down'], mouth: ['frown','smirk'] },
    sad:    { eyes: ['eyesShadow','eyes'], brows: ['down'], mouth: ['sad','frown'] },
    angry:  { eyes: ['eyes'], brows: ['down'], mouth: ['nervous','frown'] },
    surprised:{ eyes: ['round'], brows: ['up'], mouth: ['surprised'] },
    bored:  { eyes: ['eyeshadow','eyes'], brows: ['down'], mouth: ['sad','frown'] },
  };

  const target = byEmotion[emotion];

  const eyes = pickClosest(eyesVals, target.eyes);
  const eyebrows = pickClosest(browVals, target.brows);
  const mouth = pickClosest(mouthVals, target.mouth);

  return {
    ...(eyes ? { eyes: [eyes] } : {}),
    ...(eyebrows ? { eyebrows: [eyebrows] } : {}),
    ...(mouth ? { mouth: [mouth] } : {}),
  };
}