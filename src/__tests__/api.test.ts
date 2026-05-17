import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import cors from "cors";

// Set up temp file DB for API tests
import path from "path";
import fs from "fs";
const testDbPath = path.join(__dirname, "test-api.db");
process.env.DB_PATH = testDbPath;

// Clean up before tests
if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

import router from "../routes";

const app = express();
app.use(cors());
app.use(express.json());
app.use("/api/v1", router);

let projectId: string;

describe("API", () => {
  describe("Health", () => {
    it("GET /api/v1/health should return status", async () => {
      const res = await request(app).get("/api/v1/health");
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("healthy");
      expect(res.body.version).toBe("1.0.0");
      expect(res.body).toHaveProperty("uptime");
      expect(res.body).toHaveProperty("memory_count");
      expect(res.body).toHaveProperty("project_count");
    });
  });

  describe("Projects", () => {
    it("POST /api/v1/projects should create a project", async () => {
      const res = await request(app)
        .post("/api/v1/projects")
        .send({ name: "my-web-app", description: "A React web application" });
      expect(res.status).toBe(201);
      expect(res.body.name).toBe("my-web-app");
      expect(res.body.id).toBeDefined();
      projectId = res.body.id;
    });

    it("POST /api/v1/projects with duplicate name should return 409", async () => {
      const res = await request(app)
        .post("/api/v1/projects")
        .send({ name: "my-web-app" });
      expect(res.status).toBe(409);
    });

    it("GET /api/v1/projects should list projects", async () => {
      const res = await request(app).get("/api/v1/projects");
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe("my-web-app");
    });

    it("GET /api/v1/projects/:id should return a project", async () => {
      const res = await request(app).get(`/api/v1/projects/${projectId}`);
      expect(res.status).toBe(200);
      expect(res.body.name).toBe("my-web-app");
    });

    it("PUT /api/v1/projects/:id should update a project", async () => {
      const res = await request(app)
        .put(`/api/v1/projects/${projectId}`)
        .send({ description: "Updated description" });
      expect(res.status).toBe(200);
      expect(res.body.description).toBe("Updated description");
    });

    it("GET /api/v1/projects/nonexistent should return 404", async () => {
      const res = await request(app).get(
        "/api/v1/projects/00000000-0000-0000-0000-000000000000"
      );
      expect(res.status).toBe(404);
    });
  });

  describe("Memories", () => {
    let memoryId: string;

    it("POST /api/v1/memories should create a memory", async () => {
      const res = await request(app).post("/api/v1/memories").send({
        project_id: projectId,
        category: "architecture",
        title: "Use Repository Pattern for data access",
        content:
          "We decided to use the repository pattern to abstract database access. This allows easy testing and swapping of data sources.",
        tags: ["architecture", "pattern", "database"],
        importance: 8,
      });
      expect(res.status).toBe(201);
      expect(res.body.title).toBe("Use Repository Pattern for data access");
      expect(res.body.category).toBe("architecture");
      memoryId = res.body.id;
    });

    it("POST /api/v1/memories with invalid project should return 404", async () => {
      const res = await request(app).post("/api/v1/memories").send({
        project_id: "00000000-0000-0000-0000-000000000000",
        title: "Test",
        content: "Content",
      });
      expect(res.status).toBe(404);
    });

    it("GET /api/v1/memories should list memories", async () => {
      const res = await request(app).get("/api/v1/memories");
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });

    it("GET /api/v1/memories?project_id should filter by project", async () => {
      const res = await request(app).get(
        `/api/v1/memories?project_id=${projectId}`
      );
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });

    it("PUT /api/v1/memories/:id should update a memory", async () => {
      const res = await request(app)
        .put(`/api/v1/memories/${memoryId}`)
        .send({ importance: 10 });
      expect(res.status).toBe(200);
      expect(res.body.importance).toBe(10);
    });

    it("should create multiple memories for search test", async () => {
      await request(app).post("/api/v1/memories").send({
        project_id: projectId,
        category: "bug",
        title: "Fixed null pointer in auth middleware",
        content:
          "The JWT verification was failing silently when token was undefined. Added explicit null check.",
        tags: ["bug", "auth", "jwt"],
        importance: 7,
      });

      await request(app).post("/api/v1/memories").send({
        project_id: projectId,
        category: "convention",
        title: "Use camelCase for variable names",
        content:
          "Project convention: all variables use camelCase, constants use UPPER_SNAKE_CASE.",
        tags: ["convention", "naming"],
        importance: 5,
      });
    });
  });

  describe("Search", () => {
    it("POST /api/v1/search should find relevant memories", async () => {
      const res = await request(app).post("/api/v1/search").send({
        query: "auth middleware null pointer bug fix",
        project_id: projectId,
      });
      expect(res.status).toBe(200);
      expect(res.body.results.length).toBeGreaterThan(0);
    });

    it("POST /api/v1/search with category filter", async () => {
      const res = await request(app).post("/api/v1/search").send({
        query: "pattern",
        category: "architecture",
      });
      expect(res.status).toBe(200);
    });

    it("POST /api/v1/search with empty query should return 400", async () => {
      const res = await request(app).post("/api/v1/search").send({});
      expect(res.status).toBe(400);
    });
  });

  describe("Context", () => {
    it("GET /api/v1/context/:project_id should return formatted context", async () => {
      const res = await request(app)
        .get(`/api/v1/context/${projectId}`)
        .set("Accept", "application/json");
      expect(res.status).toBe(200);
      expect(res.body.project).toBeDefined();
      expect(res.body.memories).toBeDefined();
      expect(res.body.context).toBeDefined();
    });

    it("GET /api/v1/context/:project_id as markdown", async () => {
      const res = await request(app)
        .get(`/api/v1/context/${projectId}`)
        .set("Accept", "text/markdown");
      expect(res.status).toBe(200);
      expect(res.text).toContain("# Project: my-web-app");
    });
  });

  describe("Cleanup", () => {
    it("DELETE /api/v1/projects/:id should delete project and cascade", async () => {
      const res = await request(app).delete(
        `/api/v1/projects/${projectId}`
      );
      expect(res.status).toBe(204);

      const check = await request(app).get(
        `/api/v1/projects/${projectId}`
      );
      expect(check.status).toBe(404);
    });
  });
});
