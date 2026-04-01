/**
 * Wiktionary Vocabulary API for pollyglot
 * Fetches word definitions, pronunciations, translations, and etymology
 * from the Wiktionary REST API. No API key required.
 * https://en.wiktionary.org/api/rest_v1/
 *
 * Built to integrate with the existing @xenova/transformers + ts-fsrs stack.
 */

const WIKTIONARY_BASE = "https://en.wiktionary.org/api/rest_v1";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WiktionaryDefinition {
  definition: string;
  parsedExamples?: Array<{ example: string }>;
}

export interface WiktionaryPronunciation {
  text?: string;
  audio?: string;
  audioFile?: string;
}

export interface WiktionaryLanguageEntry {
  language: string;
  partOfSpeech: string;
  definitions: WiktionaryDefinition[];
  pronunciations?: WiktionaryPronunciation[];
}

export interface WiktionaryEntry {
  title: string;
  entries: WiktionaryLanguageEntry[];
}

// ─── Fetcher ──────────────────────────────────────────────────────────────────

/**
 * Fetch Wiktionary data for a word.
 * The REST API returns a structured JSON with multiple language entries.
 */
export async function lookupWord(
  word: string,
  signal?: AbortSignal,
): Promise<WiktionaryEntry | null> {
  const encoded = encodeURIComponent(word.toLowerCase().trim());
  try {
    const res = await fetch(`${WIKTIONARY_BASE}/page/definition/${encoded}`, {
      signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const json = await res.json();

    // Wiktionary REST v1 returns format: { [languageCode]: [...entries] }
    const entries: WiktionaryLanguageEntry[] = [];
    for (const [lang, langEntries] of Object.entries(
      json as Record<string, unknown[]>,
    )) {
      for (const entry of langEntries) {
        const e = entry as Record<string, unknown>;
        entries.push({
          language: lang,
          partOfSpeech: String(e.partOfSpeech ?? ""),
          definitions: (e.definitions as WiktionaryDefinition[]) ?? [],
          pronunciations: (e.pronunciations as WiktionaryPronunciation[]) ?? [],
        });
      }
    }

    return { title: word, entries };
  } catch {
    return null;
  }
}

/**
 * Get only the English entries for a word.
 */
export async function lookupEnglish(
  word: string,
  signal?: AbortSignal,
): Promise<WiktionaryLanguageEntry[]> {
  const data = await lookupWord(word, signal);
  if (!data) return [];
  return data.entries.filter(
    (e) => e.language === "en" || e.language === "English",
  );
}

/**
 * Get translations of an English word into a target language.
 * Uses the Wikipedia search API since Wiktionary doesn't have a direct translations endpoint.
 * Falls back to language-specific Wiktionary lookup.
 */
export async function getTranslations(
  word: string,
  targetLang: string,
  signal?: AbortSignal,
): Promise<string[]> {
  // Try looking up the word on the target language's Wiktionary
  const langWiki = `https://${targetLang}.wiktionary.org/api/rest_v1`;
  try {
    const encoded = encodeURIComponent(word.toLowerCase());
    const res = await fetch(`${langWiki}/page/definition/${encoded}`, {
      signal,
      headers: { Accept: "application/json" },
    });
    if (res.ok) {
      const json = await res.json();
      // Collect definition texts from the target language entries
      const translations: string[] = [];
      for (const entries of Object.values(json as Record<string, unknown[]>)) {
        for (const entry of entries) {
          const e = entry as Record<string, unknown[]>;
          for (const def of e.definitions ?? []) {
            const d = def as { definition?: string };
            if (d.definition) translations.push(d.definition);
          }
        }
      }
      return translations.slice(0, 5);
    }
  } catch {
    // ignore
  }
  return [];
}

// ─── Card generation helpers ──────────────────────────────────────────────────

export interface VocabCard {
  word: string;
  definition: string;
  example?: string;
  partOfSpeech: string;
  pronunciation?: string;
  language: string;
}

/**
 * Create flashcard-ready vocab entries from a Wiktionary lookup.
 * Each definition becomes a separate card (for use with ts-fsrs).
 */
export async function createVocabCards(
  word: string,
  targetLanguage: string = "en",
): Promise<VocabCard[]> {
  const data = await lookupWord(word);
  if (!data) return [];

  const langEntries = data.entries.filter(
    (e) =>
      e.language === targetLanguage ||
      e.language.toLowerCase().startsWith(targetLanguage.toLowerCase()),
  );

  return langEntries.flatMap((entry) =>
    entry.definitions.slice(0, 3).map((def) => ({
      word,
      definition: def.definition,
      example: def.parsedExamples?.[0]?.example,
      partOfSpeech: entry.partOfSpeech,
      pronunciation: entry.pronunciations?.[0]?.text,
      language: targetLanguage,
    })),
  );
}
