/**
 * Lightweight text embedding using TF-IDF-like approach.
 * No external API dependencies — runs fully offline.
 * For production use with large datasets, swap with OpenAI/Cohere embeddings.
 */

const VOCAB_SIZE = 512;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && t.length < 50);
}

function hashToken(token: string): number {
  let hash = 0;
  for (let i = 0; i < token.length; i++) {
    const char = token.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash) % VOCAB_SIZE;
}

export function generateEmbedding(text: string): number[] {
  const tokens = tokenize(text);
  const vector = new Array(VOCAB_SIZE).fill(0);

  const tokenFreq = new Map<string, number>();
  for (const token of tokens) {
    tokenFreq.set(token, (tokenFreq.get(token) || 0) + 1);
  }

  for (const [token, freq] of tokenFreq) {
    const idx = hashToken(token);
    const tf = freq / tokens.length;
    vector[idx] += tf;
  }

  // Bigrams for better context
  for (let i = 0; i < tokens.length - 1; i++) {
    const bigram = `${tokens[i]}_${tokens[i + 1]}`;
    const idx = hashToken(bigram);
    vector[idx] += 0.5 / tokens.length;
  }

  // Normalize
  const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  if (magnitude > 0) {
    for (let i = 0; i < vector.length; i++) {
      vector[i] /= magnitude;
    }
  }

  return vector;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}
