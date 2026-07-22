import { describe, it, expect } from 'vitest';
import { buildBalancedPersonas } from '../../src/persona/balance';

describe('buildBalancedPersonas', () => {
  it('creates 3 stances × 3 archetypes = 9 personas by default', () => {
    const personas = buildBalancedPersonas({ topic: '职场' });
    expect(personas).toHaveLength(9);

    const stances = new Set(personas.map(p => p.stance_label));
    expect(stances.size).toBe(3);
  });

  it('each stance has all 3 archetypes', () => {
    const personas = buildBalancedPersonas({ topic: '美食' });
    personas.forEach(p => {
      expect(['年轻人', '中年人', '老年人']).toContain(p.demographics.age_group);
    });
  });
});
