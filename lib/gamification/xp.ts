/**
 * XP System for Pollyglot Language Learning
 *
 * Handles experience points, levels, and XP calculations.
 */

export interface XPConfig {
  baseXpPerWord: number;
  baseXpPerReview: number;
  baseXpPerPronunciation: number;
  baseXpPerSession: number;
  baseXpPerLevel: number;
  maxLevel: number;
}

export const XP_CONFIG: XPConfig = {
  baseXpPerWord: 15,
  baseXpPerReview: 10,
  baseXpPerPronunciation: 20,
  baseXpPerSession: 25,
  baseXpPerLevel: 500,
  maxLevel: 100,
};

export interface LevelInfo {
  level: number;
  currentXp: number;
  xpForNextLevel: number;
  totalXp: number;
  progress: number;
  title: string;
}

export const LEVEL_TITLES: Record<number, string> = {
  1: 'Beginner',
  5: 'Novice',
  10: 'Student',
  15: 'Learner',
  20: 'Practitioner',
  25: 'Speaker',
  30: 'Conversationalist',
  40: 'Proficient',
  50: 'Advanced',
  60: 'Expert',
  75: 'Master',
  90: 'Virtuoso',
  100: 'Polyglot Legend',
};

export function getLevelTitle(level: number): string {
  const thresholds = Object.keys(LEVEL_TITLES)
    .map(Number)
    .sort((a, b) => b - a);

  for (const threshold of thresholds) {
    if (level >= threshold) {
      return LEVEL_TITLES[threshold];
    }
  }
  return 'Beginner';
}

export function calculateLevel(totalXp: number): number {
  let level = 1;
  let xpNeeded = XP_CONFIG.baseXpPerLevel;

  while (totalXp >= xpNeeded && level < XP_CONFIG.maxLevel) {
    totalXp -= xpNeeded;
    level++;
    xpNeeded = Math.floor(XP_CONFIG.baseXpPerLevel * Math.pow(1.05, level - 1));
  }

  return level;
}

export function getXpForLevel(level: number): number {
  return Math.floor(XP_CONFIG.baseXpPerLevel * Math.pow(1.05, level - 1));
}

export function getTotalXpForLevel(level: number): number {
  let total = 0;
  for (let i = 1; i < level; i++) {
    total += getXpForLevel(i);
  }
  return total;
}

export function getLevelInfo(totalXp: number): LevelInfo {
  const level = calculateLevel(totalXp);
  const totalXpForCurrentLevel = getTotalXpForLevel(level);
  const xpForNextLevel = getXpForLevel(level);
  const currentXp = totalXp - totalXpForCurrentLevel;
  const progress = (currentXp / xpForNextLevel) * 100;

  return {
    level,
    currentXp,
    xpForNextLevel,
    totalXp,
    progress: Math.min(progress, 100),
    title: getLevelTitle(level),
  };
}

export function calculateXpReward(
  baseXp: number,
  options: {
    streakMultiplier?: number;
    accuracyBonus?: number;
    difficultyMultiplier?: number;
  } = {}
): number {
  const {
    streakMultiplier = 1,
    accuracyBonus = 0,
    difficultyMultiplier = 1,
  } = options;

  let xp = baseXp;

  // Apply streak multiplier (capped at 2x)
  xp *= Math.min(streakMultiplier, 2);

  // Apply accuracy bonus (up to +50% for perfect accuracy)
  xp *= 1 + (accuracyBonus / 200);

  // Apply difficulty multiplier
  xp *= difficultyMultiplier;

  return Math.round(xp);
}

export function calculateWordXp(options: {
  isNewWord?: boolean;
  masteryLevel?: number;
  streakMultiplier?: number;
} = {}): number {
  const { isNewWord = true, masteryLevel = 0, streakMultiplier = 1 } = options;

  // New words give more XP
  const baseXp = isNewWord ? XP_CONFIG.baseXpPerWord : XP_CONFIG.baseXpPerReview;

  // Lower mastery = more XP (incentivize learning weak words)
  const masteryMultiplier = 1 + (1 - masteryLevel / 5) * 0.5;

  return calculateXpReward(baseXp, {
    streakMultiplier,
    difficultyMultiplier: masteryMultiplier,
  });
}

export function calculatePronunciationXp(options: {
  accuracy: number;
  streakMultiplier?: number;
} = { accuracy: 0 }): number {
  const { accuracy, streakMultiplier = 1 } = options;

  return calculateXpReward(XP_CONFIG.baseXpPerPronunciation, {
    streakMultiplier,
    accuracyBonus: accuracy,
  });
}

export function calculateSessionXp(options: {
  wordsReviewed: number;
  accuracy: number;
  streakMultiplier?: number;
} = { wordsReviewed: 0, accuracy: 0 }): number {
  const { wordsReviewed, accuracy, streakMultiplier = 1 } = options;

  // Base session XP + bonus for words reviewed
  const baseXp = XP_CONFIG.baseXpPerSession + (wordsReviewed * 2);

  return calculateXpReward(baseXp, {
    streakMultiplier,
    accuracyBonus: accuracy,
  });
}
