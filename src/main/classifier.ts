// classifier.ts
//
// v2 classification engine. Upgrades over the v1 single-token dictionary
// lookup:
//   1. Multi-word PHRASE matching (e.g. "sawed off shotgun") run against the
//      raw path before tokenization — phrases are unambiguous, so they get
//      the highest weight.
//   2. Light stemming (plurals, -ing, -ed) so the dictionary doesn't need
//      every inflection spelled out.
//   3. Subcategory-aware scoring: Weapons > Firearms beats a bare "Weapons"
//      match, so the UI can offer nested facets.
//   4. Directory weight (3x) > filename weight (1x) > extension-adjacent
//      noise words (0x, via STOP_WORDS), same as v1.
//   5. Confidence normalized to 0–1 so the UI can show a "how sure" signal
//      and sound designers can spot-check the low-confidence tail first.

import { CATEGORY_DICTIONARY } from './category-dictionary';

// ---------------------------------------------------------------
// Build lookup structures once at startup
// ---------------------------------------------------------------

interface CategoryTarget {
  category: string;
  subcategory?: string;
}

const KEYWORD_TO_TARGET = new Map<string, CategoryTarget>();
const PHRASES: { phrase: string; target: CategoryTarget; weight: number }[] = [];

for (const def of CATEGORY_DICTIONARY) {
  const target: CategoryTarget = { category: def.category, subcategory: def.subcategory };
  for (const kw of def.keywords) {
    KEYWORD_TO_TARGET.set(kw.toLowerCase(), target);
  }
  for (const phrase of def.phrases ?? []) {
    PHRASES.push({ phrase: phrase.toLowerCase(), target, weight: 4 });
  }
}

const STOP_WORDS = new Set([
  'sfx', 'sound', 'audio', 'stereo', 'mono', 'wav', 'mp3', 'ogg', 'raw',
  'snd', 'take', 'final', 'master', 'export', 'render', 'loop', 'looped',
  'ver', 'version'
]);

// ---------------------------------------------------------------
// Tokenization + light stemming
// ---------------------------------------------------------------

function tokenize(str: string): string[] {
  return str
    .toLowerCase()
    .replace(/([a-z])([A-Z])/g, '$1 $2')   // camelCase split
    .replace(/[^a-z]+/g, ' ')              // strip punctuation/digits/underscores
    .split(/\s+/)
    .filter(t => t.length > 2 && !STOP_WORDS.has(t));
}

// Strip common suffixes so "footsteps"/"stepping"/"stepped" all hit "step".
// Deliberately conservative: only strips when the stem left behind is
// still >= 3 chars, to avoid mangling short root words.
function stem(token: string): string {
  if (token.length > 6 && token.endsWith('ing')) return token.slice(0, -3);
  if (token.length > 5 && token.endsWith('ed')) return token.slice(0, -2);
  if (token.length > 4 && token.endsWith('es')) return token.slice(0, -2);
  if (token.length > 4 && token.endsWith('s') && !token.endsWith('ss')) return token.slice(0, -1);
  return token;
}

function lookupToken(token: string): CategoryTarget | undefined {
  return KEYWORD_TO_TARGET.get(token) ?? KEYWORD_TO_TARGET.get(stem(token));
}

// ---------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------

export interface ClassificationResult {
  category: string;
  subcategory?: string;
  confidence: number;   // normalized 0–1
  rawScore: number;     // pre-normalization, useful for debugging/tuning
  matchedTerms: string[];
}

// The subcategory key ("Category::Subcategory" or just "Category") lets
// generic and specific matches accumulate separately, then we roll the
// winning subcategory's score up to its parent for the final tie-break.
function targetKey(t: CategoryTarget): string {
  return t.subcategory ? `${t.category}::${t.subcategory}` : t.category;
}

export function classifySound(fullPath: string): ClassificationResult {
  const parts = fullPath.split(/[\\/]/);
  const filename = parts.pop() || '';
  const dirPath = parts.join(' ');
  const lowerFullPath = fullPath.toLowerCase();

  const scores: Record<string, number> = {};
  const matchedTerms: string[] = [];

  const addScore = (target: CategoryTarget, weight: number, term: string) => {
    const key = targetKey(target);
    scores[key] = (scores[key] || 0) + weight;
    matchedTerms.push(term);
  };

  // 1. Phrase matches (highest confidence signal, run on raw string)
  for (const { phrase, target, weight } of PHRASES) {
    if (lowerFullPath.includes(phrase)) {
      addScore(target, weight, phrase);
    }
  }

  // 2. Directory tokens (3x)
  for (const token of tokenize(dirPath)) {
    const target = lookupToken(token);
    if (target) addScore(target, 3, token);
  }

  // 3. Filename tokens (1x)
  for (const token of tokenize(filename)) {
    const target = lookupToken(token);
    if (target) addScore(target, 1, token);
  }

  // 4. Pick the winning key, preferring subcategory-level matches on ties
  let bestKey = '';
  let bestScore = 0;
  for (const [key, score] of Object.entries(scores)) {
    const isMoreSpecific = key.includes('::');
    const currentIsMoreSpecific = bestKey.includes('::');
    if (
      score > bestScore ||
      (score === bestScore && isMoreSpecific && !currentIsMoreSpecific)
    ) {
      bestScore = score;
      bestKey = key;
    }
  }

  const MIN_THRESHOLD = 1;
  if (bestScore < MIN_THRESHOLD || !bestKey) {
    return { category: 'Uncategorized', confidence: 0, rawScore: 0, matchedTerms: [] };
  }

  const [category, subcategory] = bestKey.split('::');

  // Normalize confidence: score relative to a saturation point (e.g. 8),
  // so a single filename hit ("laser.wav") isn't overstated as certain,
  // while a directory + filename + phrase match approaches 1.0.
  const SATURATION = 8;
  const confidence = Math.min(1, bestScore / SATURATION);

  return {
    category,
    subcategory: subcategory || undefined,
    confidence,
    rawScore: bestScore,
    matchedTerms: [...new Set(matchedTerms)]
  };
}

// ---------------------------------------------------------------
// Batch helper for the full 70k-file sweep
// ---------------------------------------------------------------

export interface ClassifiedFile {
  path: string;
  category: string;
  subcategory?: string;
  confidence: number;
}

export function classifyBatch(paths: string[]): ClassifiedFile[] {
  return paths.map(path => {
    const result = classifySound(path);
    return {
      path,
      category: result.category,
      subcategory: result.subcategory,
      confidence: result.confidence
    };
  });
}
