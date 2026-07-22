import type {
  PlatformAdapter,
  ContentData,
  CommentData,
  AuthorProfile,
  ContentFeatures,
  ViralityScore,
  EngagementCurve,
  NormalizedComment,
} from './types';

export abstract class BasePlatformAdapter implements PlatformAdapter {
  abstract get platformName(): string;

  async fetchContent(_url: string): Promise<ContentData> {
    throw new Error('Not implemented');
  }

  async fetchComments(_contentId: string): Promise<CommentData[]> {
    throw new Error('Not implemented');
  }

  async fetchAuthorProfile(_authorId: string): Promise<AuthorProfile> {
    throw new Error('Not implemented');
  }

  parseContentFeatures(content: ContentData): ContentFeatures {
    return {
      title_length: content.title.length,
      tag_count: content.tags.length,
      has_emoji: /[\u{1F600}-\u{1F64F}]/u.test(content.title + (content.body ?? '')),
      has_number: /\d/.test(content.title) || /[一二三四五六七八九十零〇]/.test(content.title),
      sentiment_hint: 'neutral',
    };
  }

  computeViralityScore(content: ContentData, features: ContentFeatures): ViralityScore {
    let score = 0.5;
    const factors: Record<string, number> = {};

    if (features.title_length >= 10 && features.title_length <= 25) {
      score += 0.1;
      factors.title_length = 0.1;
    }
    if (features.tag_count >= 2 && features.tag_count <= 5) {
      score += 0.1;
      factors.tag_count = 0.1;
    }
    if (features.has_emoji) {
      score += 0.05;
      factors.emoji = 0.05;
    }
    if (features.has_number) {
      score += 0.1;
      factors.number = 0.1;
    }

    return {
      score: Math.min(score, 1.0),
      confidence: 0.6,
      factors,
    };
  }

  async extractEngagementCurve(_contentId: string): Promise<EngagementCurve> {
    return {
      timestamps: [],
      likes: [],
      comments: [],
      shares: [],
    };
  }

  async detectBotTraffic(comments: CommentData[]): Promise<CommentData[]> {
    return comments;
  }

  normalizeCommentFormat(comment: CommentData): NormalizedComment {
    return {
      author_id: comment.author_id,
      text: comment.text,
      cleaned_text: comment.text.replace(/[^一-龥a-zA-Z0-9\s]/g, ''),
    };
  }

  async inferUserPersonaFromHistory(_authorId: string): Promise<string> {
    return 'default-persona';
  }

  async estimateRealAudience(_authorId: string): Promise<number> {
    return 0;
  }

  generatePlatformSpecificPrompt(content: ContentData, personaContext: string): string {
    return `${personaContext}\n\n看到这条内容：${content.title}\n请基于你的 persona 给出反应。`;
  }
}
