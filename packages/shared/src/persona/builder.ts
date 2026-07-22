import type { Persona, PersonaBuildOptions, StanceLabel } from './types';

const STANCE_DISTRIBUTION: StanceLabel[] = [
  'conservative', 'conservative', 'conservative',
  'neutral', 'neutral', 'neutral',
  'liberal', 'liberal', 'liberal',
];

const CITIES = ['一线', '新一线', '二线', '三线'];
const OCCUPATIONS = ['学生', '白领', '自由职业', '全职妈妈', '退休', '教师'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const LANGUAGES: Array<'meme' | 'formal' | 'cute'> = ['meme', 'formal', 'cute'];
const INTERESTS = ['美妆', '美食', '职场', '萌宠', '旅游', '穿搭', '健身', '数码'];

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateOCEAN(): Persona['ocean'] {
  return {
    O: randomInt(-10, 10) / 10,
    C: randomInt(-10, 10) / 10,
    E: randomInt(-10, 10) / 10,
    A: randomInt(-10, 10) / 10,
    N: randomInt(-10, 10) / 10,
  };
}

function stanceToStrength(stance: StanceLabel): number {
  if (stance === 'neutral') return randomInt(0, 3) / 10;
  return randomInt(5, 10) / 10;
}

function generatePersona(topic: string, index: number): Persona {
  const stance_label = STANCE_DISTRIBUTION[index % STANCE_DISTRIBUTION.length];
  return {
    id: `persona-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
    ocean: generateOCEAN(),
    demographics: {
      age: randomInt(18, 65),
      age_group: '年轻人',
      gender: randomChoice(['male', 'female', 'other'] as const),
      city: randomChoice(CITIES),
      occupation: randomChoice(OCCUPATIONS),
    },
    platform: {
      accountAge: randomInt(30, 3650),
      contentPreference: [randomChoice(INTERESTS)],
      behaviorPattern: randomChoice(['browse', 'search', 'follow'] as const),
      activeHours: [randomInt(0, 23)],
      dwellBaseline: randomInt(5, 60),
    },
    stance_label,
    stance_strength: stanceToStrength(stance_label),
    controversy_score: randomInt(0, 100) / 100,
    language: randomChoice(LANGUAGES),
  };
}

export class PersonaBuilder {
  buildBalanced(options: PersonaBuildOptions): Persona[] {
    const { count } = options;
    const personas: Persona[] = [];
    for (let i = 0; i < count; i++) {
      personas.push(generatePersona(options.topic, i));
    }
    return personas;
  }
}
