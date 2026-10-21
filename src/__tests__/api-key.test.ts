import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const originalApiKey = process.env.API_KEY;
const originalDbPath = process.env.DB_PATH;
const testDirectory = fs.mkdtempSync(
  path.join(os.tmpdir(), "agent-memory-hub-api-key-")
);
process.env.DB_PATH = path.join(testDirectory, "test.db");

const app = express();
app.use(express.json());

let closeDatabase: () => void;

beforeAll(async () => {
  vi.resetModules();
  const [{ default: router }, database] = await Promise.all([
    import("../routes"),
    import("../database"),
  ]);
  closeDatabase = database.closeDatabase;
  app.use("/api/v1", router);
});

beforeEach(() => {
  delete process.env.API_KEY;
});

afterAll(() => {
  closeDatabase();
  fs.rmSync(testDirectory, { recursive: true, force: true });
  if (originalApiKey === undefined) {
    delete process.env.API_KEY;
  } else {
    process.env.API_KEY = originalApiKey;
  }
  if (originalDbPath === undefined) {
    delete process.env.DB_PATH;
  } else {
    process.env.DB_PATH = originalDbPath;
  }
});

describe("API key authentication", () => {
  it("keeps routes open when API_KEY is unset", async () => {
    const response = await request(app).get("/api/v1/projects");

    expect(response.status).toBe(200);
  });

  it.each(["", " \t "])(
    "keeps routes open when API_KEY is %j",
    async (apiKey) => {
      process.env.API_KEY = apiKey;

      const response = await request(app).get("/api/v1/projects");

      expect(response.status).toBe(200);
    }
  );

  it("rejects requests with no key or an incorrect key", async () => {
    process.env.API_KEY = "expected-secret";

    const missingKey = await request(app).get("/api/v1/projects");
    const wrongKey = await request(app)
      .get("/api/v1/projects")
      .set("Authorization", "Bearer wrong");

    expect(missingKey.status).toBe(401);
    expect(missingKey.body).toEqual({ error: "Unauthorized" });
    expect(wrongKey.status).toBe(401);
    expect(wrongKey.body).toEqual({ error: "Unauthorized" });
  });

  it("accepts either supported key header", async () => {
    process.env.API_KEY = "expected-secret";

    const bearer = await request(app)
      .get("/api/v1/projects")
      .set("Authorization", "Bearer expected-secret");
    const apiKeyHeader = await request(app)
      .get("/api/v1/projects")
      .set("X-API-Key", "expected-secret");

    expect(bearer.status).toBe(200);
    expect(apiKeyHeader.status).toBe(200);
  });

  it("keeps GET /health open when API_KEY is set", async () => {
    process.env.API_KEY = "expected-secret";

    const response = await request(app).get("/api/v1/health");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("healthy");
  });
});
