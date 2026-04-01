import { createEmptyCard, fsrs, generatorParameters, Rating } from 'ts-fsrs'

// Configure FSRS with vocabulary-optimized settings
const params = generatorParameters({
  request_retention: 0.85, // Target 85% retention for vocabulary
  maximum_interval: 365,   // Max 1 year between reviews
  enable_fuzz: true,       // Add randomness to prevent clustering
})

const f = fsrs(params)

// Export Rating for external use
export { Rating }

/**
 * Create a new card for vocabulary the user hasn't seen
 * @returns {object} A new FSRS card
 */
export function createNewCard() {
  return createEmptyCard()
}

/**
 * Schedule the next review based on user's rating
 * @param {object} card - The current card state
 * @param {number} rating - Rating.Again (1), Rating.Hard (2), Rating.Good (3), or Rating.Easy (4)
 * @returns {object} Updated card with new due date
 */
export function scheduleReview(card, rating) {
  const now = new Date()
  const schedulingCards = f.repeat(card, now)
  return schedulingCards[rating].card
}

/**
 * Get all scheduling options to show the user
 * @param {object} card - The current card state
 * @returns {object} Scheduling preview for all ratings
 */
export function getSchedulingOptions(card) {
  const now = new Date()
  const scheduling = f.repeat(card, now)

  return {
    again: {
      card: scheduling[Rating.Again].card,
      interval: formatInterval(scheduling[Rating.Again].card),
    },
    hard: {
      card: scheduling[Rating.Hard].card,
      interval: formatInterval(scheduling[Rating.Hard].card),
    },
    good: {
      card: scheduling[Rating.Good].card,
      interval: formatInterval(scheduling[Rating.Good].card),
    },
    easy: {
      card: scheduling[Rating.Easy].card,
      interval: formatInterval(scheduling[Rating.Easy].card),
    },
  }
}

/**
 * Format interval for display
 * @param {object} card - Card with due date
 * @returns {string} Human-readable interval
 */
export function formatInterval(card) {
  const now = new Date()
  const due = card.due
  const diffMs = due.getTime() - now.getTime()
  const diffMins = Math.round(diffMs / (1000 * 60))
  const diffHours = Math.round(diffMs / (1000 * 60 * 60))
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))

  if (diffMins < 60) {
    return `${diffMins}m`
  } else if (diffHours < 24) {
    return `${diffHours}h`
  } else if (diffDays === 1) {
    return '1 day'
  } else if (diffDays < 30) {
    return `${diffDays} days`
  } else if (diffDays < 365) {
    const months = Math.round(diffDays / 30)
    return months === 1 ? '1 month' : `${months} months`
  } else {
    const years = Math.round(diffDays / 365)
    return years === 1 ? '1 year' : `${years} years`
  }
}

/**
 * Check if a card is due for review
 * @param {object} card - Card to check
 * @returns {boolean} True if card is due
 */
export function isDue(card) {
  return new Date() >= new Date(card.due)
}

/**
 * Get cards due for review from a list
 * @param {object[]} cards - Array of cards with due dates
 * @returns {object[]} Cards due for review, sorted by due date
 */
export function getDueCards(cards) {
  const now = new Date()
  return cards
    .filter(card => new Date(card.due) <= now)
    .sort((a, b) => new Date(a.due) - new Date(b.due))
}

/**
 * Convert card to storage-friendly format
 * @param {object} card - FSRS card
 * @returns {object} JSON-serializable card data
 */
export function cardToStorage(card) {
  return {
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    last_review: card.last_review?.toISOString() ?? null,
  }
}

/**
 * Restore card from storage format
 * @param {object} stored - Stored card data
 * @returns {object} FSRS card
 */
export function cardFromStorage(stored) {
  return {
    due: new Date(stored.due),
    stability: stored.stability ?? 0,
    difficulty: stored.difficulty ?? 0,
    elapsed_days: stored.elapsed_days ?? 0,
    scheduled_days: stored.scheduled_days ?? 0,
    learning_steps: 0,
    reps: stored.reps ?? 0,
    lapses: stored.lapses ?? 0,
    state: stored.state ?? 0,
    last_review: stored.last_review ? new Date(stored.last_review) : undefined,
  }
}
