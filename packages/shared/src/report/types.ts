export type Decision = 'publish' | 'modify' | 'not_publish' | 'retest';

export interface Metric {
  name: string;
  value: number;
  unit?: string;
}

export interface Evidence {
  source: string;
  description: string;
  confidence: number;
  refs: string[];
}

export interface Report {
  decision: Decision;
  metrics: {
    positive_ratio: number;
    negative_ratio: number;
    neutral_ratio: number;
    virality_score: number;
    diversity: number;
  };
  recommendations: string[];
  evidence: Evidence[];
  generated_at: number;
}
