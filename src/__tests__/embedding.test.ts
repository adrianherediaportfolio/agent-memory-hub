import { describe, it, expect } from "vitest";
import { generateEmbedding, cosineSimilarity } from "../embedding";

describe("Embedding", () => {
  it("should generate a fixed-length vector", () => {
    const embedding = generateEmbedding("hello world");
    expect(embedding).toHaveLength(512);
  });

  it("should generate normalized vectors", () => {
    const embedding = generateEmbedding("test input text");
    const magnitude = Math.sqrt(
      embedding.reduce((sum, v) => sum + v * v, 0)
    );
    expect(magnitude).toBeCloseTo(1.0, 4);
  });

  it("should produce similar vectors for similar text", () => {
    const a = generateEmbedding("fix authentication bug in login flow");
    const b = generateEmbedding("resolve auth issue in login system");
    const c = generateEmbedding("database migration for user table");

    const simAB = cosineSimilarity(a, b);
    const simAC = cosineSimilarity(a, c);

    expect(simAB).toBeGreaterThan(simAC);
  });

  it("should return 0 for empty vectors", () => {
    const sim = cosineSimilarity([], []);
    expect(sim).toBe(0);
  });
});

describe("Cosine Similarity", () => {
  it("should return 1 for identical vectors", () => {
    const v = generateEmbedding("identical text");
    expect(cosineSimilarity(v, v)).toBeCloseTo(1.0, 4);
  });

  it("should return value between 0 and 1 for different texts", () => {
    const a = generateEmbedding("typescript express api");
    const b = generateEmbedding("python django web");
    const sim = cosineSimilarity(a, b);
    expect(sim).toBeGreaterThanOrEqual(0);
    expect(sim).toBeLessThanOrEqual(1);
  });
});
