/**
 * Streak System for Pollyglot Language Learning
 *
 * Handles daily streak tracking and bonuses.
 */

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastPracticeDate: string | null;
  streakStartDate: string | null;
  totalDaysPracticed: number;
  weeklyActivity: boolean[];
  streakFreezes: number;
}

export const STREAK_CONFIG = {
  maxMultiplier: 2.0,
  multiplierPerDay: 0.1,
  milestones: [3, 7, 14, 30, 60, 100, 365],
  milestoneRewards: {
    3: 25,
    7: 50,
    14: 100,
    30: 250,
    60: 500,
    100: 1000,
    365: 5000,
  },
  maxFreezes: 3,
} as const;

function getDateString(date: Date = new Date()): string {
  return date.toISOString().split('T')[0];
}

function daysBetween(date1: string, date2: string): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

export function createInitialStreakData(): StreakData {
  return {
    currentStreak: 0,
    longestStreak: 0,
    lastPracticeDate: null,
    streakStartDate: null,
    totalDaysPracticed: 0,
    weeklyActivity: [false, false, false, false, false, false, false],
    streakFreezes: STREAK_CONFIG.maxFreezes,
  };
}

export function updateStreak(data: StreakData, practiceDate: Date = new Date()): StreakData {
  const today = getDateString(practiceDate);
  const newData = { ...data };

  if (data.lastPracticeDate === today) {
    return data;
  }

  if (!data.lastPracticeDate) {
    return {
      ...newData,
      currentStreak: 1,
      longestStreak: Math.max(1, data.longestStreak),
      lastPracticeDate: today,
      streakStartDate: today,
      totalDaysPracticed: data.totalDaysPracticed + 1,
      weeklyActivity: updateWeeklyActivity(data.weeklyActivity, practiceDate),
    };
  }

  const daysSinceLastPractice = daysBetween(data.lastPracticeDate, today);

  if (daysSinceLastPractice === 1) {
    const newStreak = data.currentStreak + 1;
    return {
      ...newData,
      currentStreak: newStreak,
      longestStreak: Math.max(newStreak, data.longestStreak),
      lastPracticeDate: today,
      totalDaysPracticed: data.totalDaysPracticed + 1,
      weeklyActivity: updateWeeklyActivity(data.weeklyActivity, practiceDate),
    };
  } else if (daysSinceLastPractice === 2 && data.streakFreezes > 0) {
    // Use streak freeze
    const newStreak = data.currentStreak + 1;
    return {
      ...newData,
      currentStreak: newStreak,
      longestStreak: Math.max(newStreak, data.longestStreak),
      lastPracticeDate: today,
      totalDaysPracticed: data.totalDaysPracticed + 1,
      weeklyActivity: updateWeeklyActivity(data.weeklyActivity, practiceDate),
      streakFreezes: data.streakFreezes - 1,
    };
  } else {
    return {
      ...newData,
      currentStreak: 1,
      lastPracticeDate: today,
      streakStartDate: today,
      totalDaysPracticed: data.totalDaysPracticed + 1,
      weeklyActivity: updateWeeklyActivity(data.weeklyActivity, practiceDate),
    };
  }
}

function updateWeeklyActivity(current: boolean[], date: Date): boolean[] {
  const dayOfWeek = date.getDay();
  const updated = [...current];
  updated[dayOfWeek] = true;
  return updated;
}

export function getStreakMultiplier(streak: number): number {
  const bonus = Math.min(streak * STREAK_CONFIG.multiplierPerDay, STREAK_CONFIG.maxMultiplier - 1);
  return 1 + bonus;
}

export function getStreakBonus(streak: number): {
  multiplier: number;
  bonusPercent: number;
  nextMilestone: number;
  daysToMilestone: number;
} {
  const multiplier = getStreakMultiplier(streak);
  const bonusPercent = Math.round((multiplier - 1) * 100);
  const nextMilestone = STREAK_CONFIG.milestones.find(m => m > streak) ?? 365;
  const daysToMilestone = nextMilestone - streak;

  return {
    multiplier,
    bonusPercent,
    nextMilestone,
    daysToMilestone,
  };
}

export function isStreakAtRisk(data: StreakData): boolean {
  if (!data.lastPracticeDate || data.currentStreak === 0) {
    return false;
  }

  const today = getDateString();
  const daysSincePractice = daysBetween(data.lastPracticeDate, today);

  return daysSincePractice === 1 && data.currentStreak > 0;
}

export function canUseStreakFreeze(data: StreakData): boolean {
  if (data.streakFreezes <= 0 || data.currentStreak === 0) {
    return false;
  }

  const today = getDateString();
  if (!data.lastPracticeDate) {
    return false;
  }

  const daysSincePractice = daysBetween(data.lastPracticeDate, today);
  return daysSincePractice === 2;
}

export function formatStreakMessage(streak: number): string {
  if (streak === 0) {
    return 'Start practicing to build your streak!';
  } else if (streak === 1) {
    return '1 day streak - Keep going!';
  } else if (streak < 7) {
    return `${streak} day streak! ${7 - streak} more days to reach a week!`;
  } else if (streak < 30) {
    return `${streak} day streak! You're doing great!`;
  } else if (streak < 100) {
    return `${streak} day streak! Incredible dedication!`;
  } else {
    return `${streak} day streak! You're a LEGEND!`;
  }
}

export function addStreakFreeze(data: StreakData): StreakData {
  return {
    ...data,
    streakFreezes: Math.min(data.streakFreezes + 1, STREAK_CONFIG.maxFreezes),
  };
}

export function getMilestoneProgress(streak: number): {
  current: number;
  target: number;
  progress: number;
  reward: number;
} {
  const milestones = STREAK_CONFIG.milestones;
  const currentMilestone = milestones.filter(m => m <= streak).pop() ?? 0;
  const nextMilestone = milestones.find(m => m > streak) ?? milestones[milestones.length - 1];
  const reward = STREAK_CONFIG.milestoneRewards[nextMilestone as keyof typeof STREAK_CONFIG.milestoneRewards] ?? 0;

  const progress = currentMilestone === nextMilestone
    ? 100
    : ((streak - currentMilestone) / (nextMilestone - currentMilestone)) * 100;

  return {
    current: currentMilestone,
    target: nextMilestone,
    progress: Math.min(progress, 100),
    reward,
  };
}
