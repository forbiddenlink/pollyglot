/**
 * Progress Tracking for Pollyglot Language Learning
 *
 * Manages vocabulary progress, learning stats, and spaced repetition integration.
 */

export interface LearningProgress {
  wordsLearned: string[];
  wordsMastered: string[];
  sessionsCompleted: number;
  pronunciationPractices: number;
  languagesPracticed: string[];
  totalReviews: number;
  correctReviews: number;
  lastSessionDate: string | null;
  totalTimeMinutes: number;
}

export interface ProgressStats {
  totalWords: number;
  wordsLearned: number;
  wordsMastered: number;
  vocabularyProgress: number;
  accuracy: number;
  sessionsCompleted: number;
  pronunciationPractices: number;
  totalXp: number;
  level: number;
  achievementsUnlocked: number;
  languagesCount: number;
}

export interface WordProgress {
  wordId: string;
  word: string;
  language: string;
  masteryLevel: number; // 0-5 (SM-2 based)
  easeFactor: number;
  interval: number;
  nextReviewDate: string;
  reviewCount: number;
  correctCount: number;
  lastReviewDate: string | null;
}

export function createInitialProgress(): LearningProgress {
  return {
    wordsLearned: [],
    wordsMastered: [],
    sessionsCompleted: 0,
    pronunciationPractices: 0,
    languagesPracticed: [],
    totalReviews: 0,
    correctReviews: 0,
    lastSessionDate: null,
    totalTimeMinutes: 0,
  };
}

export function createInitialWordProgress(
  wordId: string,
  word: string,
  language: string
): WordProgress {
  const today = new Date().toISOString().split('T')[0];

  return {
    wordId,
    word,
    language,
    masteryLevel: 0,
    easeFactor: 2.5,
    interval: 1,
    nextReviewDate: today,
    reviewCount: 0,
    correctCount: 0,
    lastReviewDate: null,
  };
}

export function calculateProgressStats(
  progress: LearningProgress,
  totalWords: number,
  totalXp: number,
  level: number,
  unlockedAchievements: number
): ProgressStats {
  const vocabularyProgress = totalWords > 0
    ? (progress.wordsLearned.length / totalWords) * 100
    : 0;

  const accuracy = progress.totalReviews > 0
    ? (progress.correctReviews / progress.totalReviews) * 100
    : 0;

  return {
    totalWords,
    wordsLearned: progress.wordsLearned.length,
    wordsMastered: progress.wordsMastered.length,
    vocabularyProgress: Math.round(vocabularyProgress * 10) / 10,
    accuracy: Math.round(accuracy * 10) / 10,
    sessionsCompleted: progress.sessionsCompleted,
    pronunciationPractices: progress.pronunciationPractices,
    totalXp,
    level,
    achievementsUnlocked: unlockedAchievements,
    languagesCount: progress.languagesPracticed.length,
  };
}

export function recordWordLearned(
  progress: LearningProgress,
  wordId: string,
  language: string
): LearningProgress {
  const updated = { ...progress };

  if (!updated.wordsLearned.includes(wordId)) {
    updated.wordsLearned = [...updated.wordsLearned, wordId];
  }

  if (!updated.languagesPracticed.includes(language)) {
    updated.languagesPracticed = [...updated.languagesPracticed, language];
  }

  updated.lastSessionDate = new Date().toISOString().split('T')[0];

  return updated;
}

export function recordWordMastered(
  progress: LearningProgress,
  wordId: string
): LearningProgress {
  if (progress.wordsMastered.includes(wordId)) {
    return progress;
  }

  return {
    ...progress,
    wordsMastered: [...progress.wordsMastered, wordId],
  };
}

export function recordReview(
  progress: LearningProgress,
  isCorrect: boolean
): LearningProgress {
  return {
    ...progress,
    totalReviews: progress.totalReviews + 1,
    correctReviews: progress.correctReviews + (isCorrect ? 1 : 0),
    lastSessionDate: new Date().toISOString().split('T')[0],
  };
}

export function recordSession(
  progress: LearningProgress,
  sessionMinutes: number
): LearningProgress {
  return {
    ...progress,
    sessionsCompleted: progress.sessionsCompleted + 1,
    totalTimeMinutes: progress.totalTimeMinutes + sessionMinutes,
    lastSessionDate: new Date().toISOString().split('T')[0],
  };
}

export function recordPronunciationPractice(
  progress: LearningProgress
): LearningProgress {
  return {
    ...progress,
    pronunciationPractices: progress.pronunciationPractices + 1,
    lastSessionDate: new Date().toISOString().split('T')[0],
  };
}

// SM-2 Algorithm implementation for word mastery
export function updateWordMastery(
  wordProgress: WordProgress,
  quality: number // 0-5 scale
): WordProgress {
  const today = new Date();
  const todayString = today.toISOString().split('T')[0];

  // SM-2 algorithm
  let newEaseFactor = wordProgress.easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  newEaseFactor = Math.max(1.3, newEaseFactor);

  let newInterval: number;
  let newMasteryLevel: number;

  if (quality < 3) {
    // Failed - reset interval
    newInterval = 1;
    newMasteryLevel = Math.max(0, wordProgress.masteryLevel - 1);
  } else {
    // Success - increase interval
    if (wordProgress.interval === 1) {
      newInterval = 1;
    } else if (wordProgress.interval === 2) {
      newInterval = 6;
    } else {
      newInterval = Math.round(wordProgress.interval * newEaseFactor);
    }

    newMasteryLevel = Math.min(5, wordProgress.masteryLevel + 1);
  }

  // Calculate next review date
  const nextReview = new Date(today);
  nextReview.setDate(nextReview.getDate() + newInterval);

  return {
    ...wordProgress,
    masteryLevel: newMasteryLevel,
    easeFactor: newEaseFactor,
    interval: newInterval,
    nextReviewDate: nextReview.toISOString().split('T')[0],
    reviewCount: wordProgress.reviewCount + 1,
    correctCount: wordProgress.correctCount + (quality >= 3 ? 1 : 0),
    lastReviewDate: todayString,
  };
}

export function getWordsDueForReview(
  words: WordProgress[],
  date: Date = new Date()
): WordProgress[] {
  const dateString = date.toISOString().split('T')[0];
  return words.filter(w => w.nextReviewDate <= dateString);
}

export function getWordsNeedingPractice(
  words: WordProgress[],
  count: number = 10
): WordProgress[] {
  // Prioritize: due words, then low mastery, then new words
  const due = getWordsDueForReview(words);
  const sorted = [...due].sort((a, b) => {
    if (a.masteryLevel !== b.masteryLevel) {
      return a.masteryLevel - b.masteryLevel;
    }
    return a.nextReviewDate.localeCompare(b.nextReviewDate);
  });

  return sorted.slice(0, count);
}

export function formatTimeSpent(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours < 24) {
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
}
