import type { Decision } from './types';

export interface DecisionInputs {
  positiveRatio: number;
  negativeRatio: number;
  diversity: number;
  manualInterventionRequired: boolean;
}

export function decideRecommendation(inputs: DecisionInputs): Decision {
  if (inputs.manualInterventionRequired) {
    return 'retest';
  }

  if (inputs.diversity < 0.20) {
    return 'not_publish';
  }

  if (inputs.positiveRatio >= 0.60 && inputs.diversity >= 0.50) {
    return 'publish';
  }

  if (inputs.positiveRatio >= 0.40 && inputs.diversity >= 0.30) {
    return 'modify';
  }

  return 'not_publish';
}
