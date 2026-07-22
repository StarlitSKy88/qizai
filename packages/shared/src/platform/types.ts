export interface ContentData {
  title: string;
  cover: string;
  tags: string[];
  body?: string;
}

export interface CommentData {
  id: string;
  author_id: string;
  text: string;
  likes: number;
  timestamp: number;
}

export interface AuthorProfile {
  id: string;
  followers: number;
  content_count: number;
  avg_engagement: number;
}

export interface ContentFeatures {
  title_length: number;
  tag_count: number;
  has_emoji: boolean;
  has_number: boolean;
  sentiment_hint: 'positive' | 'neutral' | 'negative';
}

export interface ViralityScore {
  score: number;
  confidence: number;
  factors: Record<string, number>;
}

export interface EngagementCurve {
  timestamps: number[];
  likes: number[];
  comments: number[];
  shares: number[];
}

export interface NormalizedComment {
  author_id: string;
  text: string;
  stance_hint?: string;
  cleaned_text: string;
}

export interface PlatformAdapter {
  fetchContent(url: string): Promise<ContentData>;
  fetchComments(contentId: string): Promise<CommentData[]>;
  fetchAuthorProfile(authorId: string): Promise<AuthorProfile>;
  parseContentFeatures(content: ContentData): ContentFeatures;
  computeViralityScore(content: ContentData, features: ContentFeatures): ViralityScore;
  extractEngagementCurve(contentId: string): Promise<EngagementCurve>;
  detectBotTraffic(comments: CommentData[]): Promise<CommentData[]>;
  normalizeCommentFormat(comment: CommentData): NormalizedComment;
  inferUserPersonaFromHistory(authorId: string): Promise<string>;
  estimateRealAudience(authorId: string): Promise<number>;
  generatePlatformSpecificPrompt(content: ContentData, personaContext: string): string;
}
