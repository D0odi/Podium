export type Persona = {
  stance: "supportive" | "skeptical" | "curious";
  domain: "tech" | "design" | "finance";
  description: string;
};

export type AudienceBot = {
  id: string;
  name: string;
  avatar: string; // emoji glyph
  persona: Persona;
};

// Local alias used in components expecting `Bot`
export type Bot = AudienceBot;
