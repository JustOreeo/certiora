/**
 * Exam type defaults (question counts) per architecture plan.
 */
export const EXAM_TYPE_QUESTION_COUNTS = {
  SHORT_QUIZ: { min: 10, max: 15, default: 12 },
  QUICK_EXAM: { min: 30, max: 40, default: 35 },
  MOCK_EXAM: { min: 70, max: 100, default: 85 },
} as const;

/**
 * Optional time limit in minutes per exam type. null = no limit.
 */
export const EXAM_TYPE_TIME_LIMIT_MINUTES = {
  SHORT_QUIZ: null as number | null,
  QUICK_EXAM: 60,
  MOCK_EXAM: 120,
} as const;

/**
 * SM-2 algorithm defaults for SRS.
 */
export const SRS_DEFAULTS = {
  INITIAL_EASE_FACTOR: 2.5,
  MIN_EASE_FACTOR: 1.3,
  EASE_BONUS: 0.15,
  INTERVAL_MODIFIER: 1.0,
} as const;
