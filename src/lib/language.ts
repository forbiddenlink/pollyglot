/**
 * Language detection and NLP utilities for PollyGlot.
 * Detects language, analyzes grammar, and extracts vocabulary.
 */
import { franc } from "franc";
import nlp from "compromise";
import natural from "natural";

const tokenizer = new natural.WordTokenizer();
const stemmer = natural.PorterStemmer;

/** Detect the language of a text snippet. Returns ISO 639-3 code. */
export function detectLanguage(text: string): {
  code: string;
  confidence: "high" | "medium" | "low";
} {
  const code = franc(text, { minLength: 10 });
  if (code === "und") return { code: "und", confidence: "low" };

  // franc doesn't return confidence directly, so estimate from length
  const confidence =
    text.length > 100 ? "high" : text.length > 40 ? "medium" : "low";
  return { code, confidence };
}

/** Tokenize text into words. */
export function tokenize(text: string): string[] {
  return tokenizer.tokenize(text) ?? [];
}

/** Stem a word to its root form. */
export function stem(word: string): string {
  return stemmer.stem(word);
}

/** Extract nouns, verbs and adjectives from text — useful for vocabulary practice. */
export function extractVocabulary(text: string): {
  nouns: string[];
  verbs: string[];
  adjectives: string[];
} {
  const doc = nlp(text);
  return {
    nouns: doc.nouns().out("array") as string[],
    verbs: doc.verbs().out("array") as string[],
    adjectives: doc.adjectives().out("array") as string[],
  };
}

/** Split text into sentences. */
export function extractSentences(text: string): string[] {
  const doc = nlp(text);
  return doc.sentences().out("array") as string[];
}

/** Build a simple frequency map for vocabulary study. */
export function wordFrequency(text: string): Record<string, number> {
  const words = tokenize(text.toLowerCase());
  return words.reduce<Record<string, number>>((acc, word) => {
    acc[word] = (acc[word] ?? 0) + 1;
    return acc;
  }, {});
}

/** ISO 639-3 → human-readable language name map (common entries). */
export const LANGUAGE_NAMES: Record<string, string> = {
  eng: "English",
  spa: "Spanish",
  fra: "French",
  deu: "German",
  ita: "Italian",
  por: "Portuguese",
  rus: "Russian",
  zho: "Chinese",
  jpn: "Japanese",
  kor: "Korean",
  ara: "Arabic",
  hin: "Hindi",
  und: "Unknown",
};
