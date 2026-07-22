import { describe, it, expect } from 'vitest';
import { XHSAdapter } from '../../src/platform/xhs';
import { AdapterRegistry } from '../../src/platform/registry';

describe('XHSAdapter', () => {
  it('implements all 11 required methods', () => {
    const adapter = new XHSAdapter();
    const requiredMethods = [
      'fetchContent',
      'fetchComments',
      'fetchAuthorProfile',
      'parseContentFeatures',
      'computeViralityScore',
      'extractEngagementCurve',
      'detectBotTraffic',
      'normalizeCommentFormat',
      'inferUserPersonaFromHistory',
      'estimateRealAudience',
      'generatePlatformSpecificPrompt',
    ];

    requiredMethods.forEach(method => {
      expect(typeof (adapter as any)[method]).toBe('function');
    });
  });

  it('parses XHS content features correctly', () => {
    const adapter = new XHSAdapter();
    const features = adapter.parseContentFeatures({
      title: '三招教你选对洗面奶',
      cover: 'image-url',
      tags: ['美妆', '护肤'],
    });

    expect(features.title_length).toBe('三招教你选对洗面奶'.length);
    expect(features.tag_count).toBe(2);
    expect(features.has_number).toBe(true);
  });
});

describe('AdapterRegistry', () => {
  it('registers and retrieves adapters by platform name', () => {
    const registry = new AdapterRegistry();
    const xhs = new XHSAdapter();
    registry.register('xhs', xhs);

    const retrieved = registry.get('xhs');
    expect(retrieved).toBe(xhs);
  });

  it('returns null for unknown platform', () => {
    const registry = new AdapterRegistry();
    const result = registry.get('unknown');
    expect(result).toBeNull();
  });
});
