/**
 * Achievement Definitions for Pollyglot Language Learning
 *
 * Defines all unlockable achievements with their requirements and rewards.
 */

export type AchievementCategory =
  | 'vocabulary'
  | 'pronunciation'
  | 'streak'
  | 'mastery'
  | 'practice'
  | 'special';

export type AchievementRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  category: AchievementCategory;
  rarity: AchievementRarity;
  xp: number;
  icon: string;
  requirement: {
    type: 'words' | 'sessions' | 'streak' | 'accuracy' | 'pronunciation' | 'special';
    value: number;
    condition?: string;
  };
  secret?: boolean;
}

export const ACHIEVEMENTS: Record<string, Achievement> = {
  // Vocabulary Achievements
  first_word: {
    id: 'first_word',
    name: 'First Steps',
    description: 'Learn your first word',
    category: 'vocabulary',
    rarity: 'common',
    xp: 10,
    icon: 'book',
    requirement: { type: 'words', value: 1 },
  },
  vocabulary_10: {
    id: 'vocabulary_10',
    name: 'Word Collector',
    description: 'Learn 10 words',
    category: 'vocabulary',
    rarity: 'common',
    xp: 25,
    icon: 'book-open',
    requirement: { type: 'words', value: 10 },
  },
  vocabulary_50: {
    id: 'vocabulary_50',
    name: 'Vocabulary Builder',
    description: 'Learn 50 words',
    category: 'vocabulary',
    rarity: 'rare',
    xp: 75,
    icon: 'library',
    requirement: { type: 'words', value: 50 },
  },
  vocabulary_100: {
    id: 'vocabulary_100',
    name: 'Word Enthusiast',
    description: 'Learn 100 words',
    category: 'vocabulary',
    rarity: 'rare',
    xp: 150,
    icon: 'bookmark',
    requirement: { type: 'words', value: 100 },
  },
  vocabulary_250: {
    id: 'vocabulary_250',
    name: 'Vocabulary Expert',
    description: 'Learn 250 words',
    category: 'vocabulary',
    rarity: 'epic',
    xp: 300,
    icon: 'book-marked',
    requirement: { type: 'words', value: 250 },
  },
  vocabulary_500: {
    id: 'vocabulary_500',
    name: 'Linguistic Scholar',
    description: 'Learn 500 words',
    category: 'vocabulary',
    rarity: 'epic',
    xp: 500,
    icon: 'graduation-cap',
    requirement: { type: 'words', value: 500 },
  },
  vocabulary_1000: {
    id: 'vocabulary_1000',
    name: 'Vocabulary Master',
    description: 'Learn 1000 words',
    category: 'vocabulary',
    rarity: 'legendary',
    xp: 1000,
    icon: 'crown',
    requirement: { type: 'words', value: 1000 },
  },

  // Pronunciation Achievements
  first_recording: {
    id: 'first_recording',
    name: 'Finding Your Voice',
    description: 'Complete your first pronunciation practice',
    category: 'pronunciation',
    rarity: 'common',
    xp: 15,
    icon: 'mic',
    requirement: { type: 'pronunciation', value: 1 },
  },
  pronunciation_10: {
    id: 'pronunciation_10',
    name: 'Voice Warm-up',
    description: 'Complete 10 pronunciation practices',
    category: 'pronunciation',
    rarity: 'common',
    xp: 30,
    icon: 'mic',
    requirement: { type: 'pronunciation', value: 10 },
  },
  pronunciation_50: {
    id: 'pronunciation_50',
    name: 'Clear Speaker',
    description: 'Complete 50 pronunciation practices',
    category: 'pronunciation',
    rarity: 'rare',
    xp: 100,
    icon: 'volume-2',
    requirement: { type: 'pronunciation', value: 50 },
  },
  pronunciation_100: {
    id: 'pronunciation_100',
    name: 'Fluent Speaker',
    description: 'Complete 100 pronunciation practices',
    category: 'pronunciation',
    rarity: 'epic',
    xp: 250,
    icon: 'audio-lines',
    requirement: { type: 'pronunciation', value: 100 },
  },
  perfect_pronunciation: {
    id: 'perfect_pronunciation',
    name: 'Perfect Accent',
    description: 'Get 100% accuracy on pronunciation',
    category: 'pronunciation',
    rarity: 'epic',
    xp: 200,
    icon: 'star',
    requirement: { type: 'accuracy', value: 100, condition: 'pronunciation' },
  },

  // Streak Achievements
  streak_3: {
    id: 'streak_3',
    name: 'Getting Started',
    description: 'Practice for 3 days in a row',
    category: 'streak',
    rarity: 'common',
    xp: 20,
    icon: 'flame',
    requirement: { type: 'streak', value: 3 },
  },
  streak_7: {
    id: 'streak_7',
    name: 'Week Warrior',
    description: 'Practice for 7 days in a row',
    category: 'streak',
    rarity: 'rare',
    xp: 50,
    icon: 'flame',
    requirement: { type: 'streak', value: 7 },
  },
  streak_14: {
    id: 'streak_14',
    name: 'Two Week Champion',
    description: 'Practice for 14 days in a row',
    category: 'streak',
    rarity: 'rare',
    xp: 100,
    icon: 'flame',
    requirement: { type: 'streak', value: 14 },
  },
  streak_30: {
    id: 'streak_30',
    name: 'Monthly Master',
    description: 'Practice for 30 days in a row',
    category: 'streak',
    rarity: 'epic',
    xp: 250,
    icon: 'flame',
    requirement: { type: 'streak', value: 30 },
  },
  streak_100: {
    id: 'streak_100',
    name: 'Century Streak',
    description: 'Practice for 100 days in a row',
    category: 'streak',
    rarity: 'legendary',
    xp: 1000,
    icon: 'flame',
    requirement: { type: 'streak', value: 100 },
  },
  streak_365: {
    id: 'streak_365',
    name: 'Year-Long Dedication',
    description: 'Practice for 365 days in a row',
    category: 'streak',
    rarity: 'legendary',
    xp: 5000,
    icon: 'crown',
    requirement: { type: 'streak', value: 365 },
  },

  // Practice Achievements
  first_session: {
    id: 'first_session',
    name: 'Practice Begun',
    description: 'Complete your first practice session',
    category: 'practice',
    rarity: 'common',
    xp: 10,
    icon: 'play',
    requirement: { type: 'sessions', value: 1 },
  },
  sessions_10: {
    id: 'sessions_10',
    name: 'Regular Learner',
    description: 'Complete 10 practice sessions',
    category: 'practice',
    rarity: 'common',
    xp: 30,
    icon: 'repeat',
    requirement: { type: 'sessions', value: 10 },
  },
  sessions_50: {
    id: 'sessions_50',
    name: 'Dedicated Student',
    description: 'Complete 50 practice sessions',
    category: 'practice',
    rarity: 'rare',
    xp: 100,
    icon: 'target',
    requirement: { type: 'sessions', value: 50 },
  },
  sessions_100: {
    id: 'sessions_100',
    name: 'Practice Perfectionist',
    description: 'Complete 100 practice sessions',
    category: 'practice',
    rarity: 'epic',
    xp: 250,
    icon: 'award',
    requirement: { type: 'sessions', value: 100 },
  },

  // Mastery Achievements
  first_mastery: {
    id: 'first_mastery',
    name: 'First Mastery',
    description: 'Fully master your first word',
    category: 'mastery',
    rarity: 'rare',
    xp: 50,
    icon: 'check-circle',
    requirement: { type: 'special', value: 1, condition: 'mastered_words' },
  },
  mastery_10: {
    id: 'mastery_10',
    name: 'Word Expert',
    description: 'Fully master 10 words',
    category: 'mastery',
    rarity: 'rare',
    xp: 100,
    icon: 'shield-check',
    requirement: { type: 'special', value: 10, condition: 'mastered_words' },
  },
  mastery_50: {
    id: 'mastery_50',
    name: 'Language Specialist',
    description: 'Fully master 50 words',
    category: 'mastery',
    rarity: 'epic',
    xp: 300,
    icon: 'medal',
    requirement: { type: 'special', value: 50, condition: 'mastered_words' },
  },

  // Special Achievements
  polyglot_starter: {
    id: 'polyglot_starter',
    name: 'Polyglot Starter',
    description: 'Practice in 2 different languages',
    category: 'special',
    rarity: 'rare',
    xp: 75,
    icon: 'globe',
    requirement: { type: 'special', value: 2, condition: 'languages' },
  },
  true_polyglot: {
    id: 'true_polyglot',
    name: 'True Polyglot',
    description: 'Practice in 5 different languages',
    category: 'special',
    rarity: 'legendary',
    xp: 500,
    icon: 'globe',
    requirement: { type: 'special', value: 5, condition: 'languages' },
  },
  night_learner: {
    id: 'night_learner',
    name: 'Night Learner',
    description: 'Practice after midnight',
    category: 'special',
    rarity: 'common',
    xp: 20,
    icon: 'moon',
    requirement: { type: 'special', value: 1, condition: 'night_session' },
    secret: true,
  },
  early_bird: {
    id: 'early_bird',
    name: 'Early Bird',
    description: 'Practice before 6 AM',
    category: 'special',
    rarity: 'common',
    xp: 20,
    icon: 'sun',
    requirement: { type: 'special', value: 1, condition: 'morning_session' },
    secret: true,
  },
  weekend_warrior: {
    id: 'weekend_warrior',
    name: 'Weekend Warrior',
    description: 'Practice on both Saturday and Sunday',
    category: 'special',
    rarity: 'common',
    xp: 25,
    icon: 'calendar',
    requirement: { type: 'special', value: 1, condition: 'weekend_complete' },
  },
};

export const RARITY_CONFIG: Record<AchievementRarity, { color: string; glow: string; multiplier: number }> = {
  common: {
    color: 'from-slate-400 to-slate-600',
    glow: 'shadow-slate-400/30',
    multiplier: 1,
  },
  rare: {
    color: 'from-blue-400 to-blue-600',
    glow: 'shadow-blue-400/30',
    multiplier: 1.5,
  },
  epic: {
    color: 'from-purple-400 to-pink-600',
    glow: 'shadow-purple-400/30',
    multiplier: 2,
  },
  legendary: {
    color: 'from-amber-400 to-orange-600',
    glow: 'shadow-amber-400/40',
    multiplier: 3,
  },
};

export function getAchievementById(id: string): Achievement | undefined {
  return ACHIEVEMENTS[id];
}

export function getAchievementsByCategory(category: AchievementCategory): Achievement[] {
  return Object.values(ACHIEVEMENTS).filter(a => a.category === category);
}

export function getVisibleAchievements(unlockedIds: string[]): Achievement[] {
  return Object.values(ACHIEVEMENTS).filter(
    a => !a.secret || unlockedIds.includes(a.id)
  );
}
