export type StanceLabel = 'conservative' | 'liberal' | 'neutral';

export interface OCEAN {
  O: number;
  C: number;
  E: number;
  A: number;
  N: number;
}

export interface Demographics {
  age: number;
  age_group: '年轻人' | '中年人' | '老年人';
  gender: 'male' | 'female' | 'other';
  city: string;
  occupation: string;
}

export interface PlatformTraits {
  accountAge: number;
  contentPreference: string[];
  behaviorPattern: 'browse' | 'search' | 'follow';
  activeHours: number[];
  dwellBaseline: number;
}

export interface Persona {
  id: string;
  ocean: OCEAN;
  demographics: Demographics;
  platform: PlatformTraits;
  stance_label: StanceLabel;
  stance_strength: number;
  controversy_score: number;
  language: 'meme' | 'formal' | 'cute';
}

export interface PersonaBuildOptions {
  topic: string;
  count: number;
}
