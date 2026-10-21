import { Router, Request, Response } from "express";
import { timingSafeEqual } from "node:crypto";
import type { MemoryCategory } from "./types";
import { formatProjectContext } from "./context";
import {
  createProject,
  getProject,
  listProjects,
  updateProject,
  deleteProject,
  createMemory,
  getMemory,
  listMemories,
  updateMemory,
  deleteMemory,
  searchMemories,
  getStats,
} from "./store";
import {
  CreateProjectSchema,
  UpdateProjectSchema,
  CreateMemorySchema,
  UpdateMemorySchema,
  SearchQuerySchema,
} from "./types";

const router = Router();

// ── Health ──

router.get("/health", (_req: Request, res: Response) => {
  const stats = getStats();
  res.json({
    status: "healthy",
    version: "1.1.0",
    uptime: process.uptime(),
    ...stats,
  });
});

router.use((req: Request, res: Response, next) => {
  const apiKey = process.env.API_KEY;
  if (apiKey === undefined) {
    next();
    return;
  }

  const expected = Buffer.from(apiKey, "utf8");
  const bearer = req
    .get("authorization")
    ?.match(/^Bearer\s+(.+)$/i)?.[1];
  const candidates = [bearer, req.get("x-api-key")];
  const authorized = candidates.some((candidate) => {
    if (!candidate) return false;
    const provided = Buffer.from(candidate, "utf8");
    return (
      provided.length === expected.length &&
      timingSafeEqual(provided, expected)
    );
  });

  if (!authorized) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
});

// ── Projects ──

router.post("/projects", (req: Request, res: Response) => {
  const parsed = CreateProjectSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }

  try {
    const project = createProject(parsed.data.name, parsed.data.description);
    res.status(201).json(project);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("UNIQUE constraint")) {
      res.status(409).json({ error: "Project with this name already exists" });
      return;
    }
    res.status(500).json({ error: message });
  }
});

router.get("/projects", (_req: Request, res: Response) => {
  const projects = listProjects();
  res.json(projects);
});

router.get("/projects/:id", (req: Request, res: Response) => {
  const id = req.params.id as string;
  const project = getProject(id);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  res.json(project);
});

router.put("/projects/:id", (req: Request, res: Response) => {
  const parsed = UpdateProjectSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }

  const id = req.params.id as string;
  const project = updateProject(id, parsed.data);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  res.json(project);
});

router.delete("/projects/:id", (req: Request, res: Response) => {
  const id = req.params.id as string;
  const deleted = deleteProject(id);
  if (!deleted) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  res.status(204).send();
});

// ── Memories ──

router.post("/memories", (req: Request, res: Response) => {
  const parsed = CreateMemorySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }

  const project = getProject(parsed.data.project_id);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const memory = createMemory(parsed.data);
  res.status(201).json(memory);
});

router.get("/memories", (req: Request, res: Response) => {
  const memories = listMemories({
    project_id: req.query.project_id as string | undefined,
    category: req.query.category as MemoryCategory | undefined,
    limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
    offset: req.query.offset ? parseInt(req.query.offset as string) : undefined,
  });
  res.json(memories);
});

router.get("/memories/:id", (req: Request, res: Response) => {
  const memId = req.params.id as string;
  const memory = getMemory(memId);
  if (!memory) {
    res.status(404).json({ error: "Memory not found" });
    return;
  }
  res.json(memory);
});

router.put("/memories/:id", (req: Request, res: Response) => {
  const parsed = UpdateMemorySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }

  const memId = req.params.id as string;
  const memory = updateMemory(memId, parsed.data);
  if (!memory) {
    res.status(404).json({ error: "Memory not found" });
    return;
  }
  res.json(memory);
});

router.delete("/memories/:id", (req: Request, res: Response) => {
  const memId = req.params.id as string;
  const deleted = deleteMemory(memId);
  if (!deleted) {
    res.status(404).json({ error: "Memory not found" });
    return;
  }
  res.status(204).send();
});

// ── Search ──

router.post("/search", (req: Request, res: Response) => {
  const parsed = SearchQuerySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }

  const results = searchMemories(parsed.data);
  res.json({
    query: parsed.data.query,
    count: results.length,
    results: results.map((r) => ({
      ...r.memory,
      relevance_score: Math.round(r.score * 1000) / 1000,
    })),
  });
});

// ── Context (for agents) ──

router.get("/context/:project_id", (req: Request, res: Response) => {
  const projectId = req.params.project_id as string;
  const project = getProject(projectId);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const category = req.query.category as string | undefined;
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;

  const memories = listMemories({
    project_id: projectId,
    category: category as MemoryCategory | undefined,
    limit,
  });

  const contextText = formatProjectContext(project, memories);

  if (req.headers.accept === "application/json") {
    res.json({ project, memories, context: contextText });
  } else {
    res.type("text/markdown").send(contextText);
  }
});

export default router;
