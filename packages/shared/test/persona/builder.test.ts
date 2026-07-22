import { describe, it, expect } from 'vitest';
import { PersonaBuilder } from '../../src/persona/builder';

describe('PersonaBuilder', () => {
  it('builds a balanced persona set with stance_label diversity', () => {
    const builder = new PersonaBuilder();
    const personas = builder.buildBalanced({ topic: '面试技巧', count: 9 });

    expect(personas).toHaveLength(9);

    const stances = personas.map(p => p.stance_label);
    const conservative = stances.filter(s => s === 'conservative').length;
    const liberal = stances.filter(s => s === 'liberal').length;
    const neutral = stances.filter(s => s === 'neutral').length;

    expect(conservative).toBeGreaterThanOrEqual(1);
    expect(liberal).toBeGreaterThanOrEqual(1);
    expect(neutral).toBeGreaterThanOrEqual(1);
  });

  it('assigns stance_strength in [0, 1]', () => {
    const builder = new PersonaBuilder();
    const personas = builder.buildBalanced({ topic: '美食', count: 100 });

    personas.forEach(p => {
      expect(p.stance_strength).toBeGreaterThanOrEqual(0);
      expect(p.stance_strength).toBeLessThanOrEqual(1);
    });
  });

  it('includes OCEAN personality traits in [-1, 1]', () => {
    const builder = new PersonaBuilder();
    const personas = builder.buildBalanced({ topic: '美妆', count: 50 });

    personas.forEach(p => {
      expect(p.ocean.O).toBeGreaterThanOrEqual(-1);
      expect(p.ocean.O).toBeLessThanOrEqual(1);
      expect(p.ocean.C).toBeGreaterThanOrEqual(-1);
      expect(p.ocean.C).toBeLessThanOrEqual(1);
    });
  });
});
