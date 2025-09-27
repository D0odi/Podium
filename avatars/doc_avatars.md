1. Install: `npm i @dicebear/core @dicebear/collection`

2. Use:

##
import { createAvatar } from '@dicebear/core';
import { micah, avataaars } from '@dicebear/collection';

export type StyleName = 'micah' | 'avataaars';

const styles = {
  micah, // https://www.dicebear.com/playground/?style=micah
  avataaars, //https://www.dicebear.com/playground/?style=avataaars
} as const;

export function renderAvatarSVG(
  styleName: StyleName,
  seed: string,
  options: Record<string, unknown> = {}
): string {
  const style = styles[styleName];
  // Common, safe global options across styles
  const common = {
    seed,
    size: 128,
    radius: 8,
    randomizeIds: true,
  };
  return createAvatar(style, { ...common, ...options }).toString();
}
##

3. Options to have (Micah)
   Core you’ll actually tweak

    seed: string — stable identity per bot (e.g., bot-17). 

    flip: boolean — easy neutral/mirror variant. 

    baseColor: string[] (hex or "transparent") — skin/base. Range: #FFEBCD – #A0522D. 

    earrings: ["hoop","stud"] and earringsProbability: 0..100.

    ears: ["attached","detached"]

    eyeShadowColor: string[] (hex or "transparent")

    eyebrows: ["down","eyelashesDown","eyelashesUp","up"]

    eyes: ["eyes","eyesShadow","round","smiling","smilingShadow"]

    eyesColor: string[] (hex or "transparent")

    facialHair: ["beard","scruff"] + facialHairColor: string[] (hex or "transparent") + facialHairProbability: 0..100

    glasses: ["round","square"] + glassesColor: string[] (hex or "transparent") + glassesProbability: 0..100. 

    hair: ["dannyPhantom","dougFunny","fonze","full","mrClean","mrT","pixie","turban"]
        male: ["dannyPhantom","dougFunny","fonze","mrClean","mrT","turban"]
        female: ["dannyPhantom","full","pixie,"turban"]

    hairColor: string[] — hex or "transparent"

    hairProbability: 100

    mouth: ["frown","laughing","nervous","pucker","sad","smile","smirk","surprised"]

    mouthColor: ["000000"]

    nose: ["curve","pointed","tound"]

    shirt: ["collared","crew","open"] + shirtColor: string[] — hex or "transparent"


4. Options to have (Avataaar)

    accessories: ["prescription01","prescription02","round"] + accessoriesColor: string[] — hex or "transparent"

    accessoriesProbability: 0..100

    clothing: ["blazerAndShirt","blazerAndSweater","collarAndSweater","graphicShirt","hoodie","overall","shirtCrewNeck","shirtScoopNeck","shirtVNeck"] + clothesColor: string[] — hex or "transparent"

    eyebrows: ["angry","angryNatural","default","defaultNatural","flatNatural","frownNatural","raisedExcited","raisedExcitedNatural","sadConcerned","sadConcernedNatural","unibrowNatural","upDown","upDownNatural"]

    eyes: ["closed","cry","default","eyeRoll","happy","hearts","side","squint","surprised","wink","winkWacky","xDizzy"]

    facialHair: ["beardLight","beardMajestic","beardMedium","moustacheFancy","moustacheMagnum"] + facialHairColor: string[] — hex or "transparent" + facialHairProbability: 0..100

    mouth: ["concerned","default","disbelief","grimace","sad","screamOpen","serious","smile","twinkle"]

    nose: ["default"]

    skinColor: string[] — hex or "transparent"

    top: ["bigHair","bob","bun","curly","curvy","dreads","dreads01","dreads02","frida","frizzle","fro","froBand","longButNotTooLong","miaWallace","shaggy","shaggyMullet","shavedSides","shortCurly","shortFlat","shortRound","shortWaved","sides","straight01","straight02","straightAndStrand","theCaesar","theCaesarAndSidePart"] + topProbability: 0..100