import { v4 as uuidv4 } from "uuid";
import { getDatabase } from "./database";
import { generateEmbedding, cosineSimilarity } from "./embedding";
import type {
  Project,
  Memory,
  SearchResult,
  MemoryCategory,
} from "./types";

// ── Projects ──

export function createProject(
  name: string,
  description?: string
): Project {
  const db = getDatabase();
  const id = uuidv4();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO projects (id, name, description, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(id, name, description || null, now, now);

  return getProject(id)!;
}

export function getProject(id: string): Project | null {
  const db = getDatabase();
  const row = db
    .prepare("SELECT * FROM projects WHERE id = ?")
    .get(id) as Project | undefined;
  return row || null;
}

export function listProjects(): Project[] {
  const db = getDatabase();
  return db
    .prepare("SELECT * FROM projects ORDER BY updated_at DESC")
    .all() as Project[];
}

export function updateProject(
  id: string,
  updates: { name?: string; description?: string }
): Project | null {
  const db = getDatabase();
  const existing = getProject(id);
  if (!existing) return null;

  const name = updates.name ?? existing.name;
  const description = updates.description ?? existing.description;
  const now = new Date().toISOString();

  db.prepare(
    `UPDATE projects SET name = ?, description = ?, updated_at = ? WHERE id = ?`
  ).run(name, description, now, id);

  return getProject(id);
}

export function deleteProject(id: string): boolean {
  const db = getDatabase();
  const result = db.prepare("DELETE FROM projects WHERE id = ?").run(id);
  return result.changes > 0;
}

// ── Memories ──

export function createMemory(params: {
  project_id: string;
  category: MemoryCategory;
  title: string;
  content: string;
  tags: string[];
  importance: number;
}): Memory {
  const db = getDatabase();
  const id = uuidv4();
  const now = new Date().toISOString();
  const embedding = generateEmbedding(`${params.title} ${params.content}`);

  db.prepare(
    `INSERT INTO memories (id, project_id, category, title, content, tags, importance, embedding, created_at, updated_at, accessed_at, access_count)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`
  ).run(
    id,
    params.project_id,
    params.category,
    params.title,
    params.content,
    JSON.stringify(params.tags),
    params.importance,
    JSON.stringify(embedding),
    now,
    now,
    now
  );

  return getMemory(id)!;
}

export function getMemory(id: string): Memory | null {
  const db = getDatabase();
  const row = db.prepare("SELECT * FROM memories WHERE id = ?").get(id) as
    | Record<string, unknown>
    | undefined;
  if (!row) return null;

  // Update access tracking
  db.prepare(
    `UPDATE memories SET accessed_at = datetime('now'), access_count = access_count + 1 WHERE id = ?`
  ).run(id);

  return deserializeMemory(row);
}

export function listMemories(params: {
  project_id?: string;
  category?: MemoryCategory;
  limit?: number;
  offset?: number;
}): Memory[] {
  const db = getDatabase();
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (params.project_id) {
    conditions.push("project_id = ?");
    values.push(params.project_id);
  }
  if (params.category) {
    conditions.push("category = ?");
    values.push(params.category);
  }

  const where =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = params.limit || 50;
  const offset = params.offset || 0;

  const rows = db
    .prepare(
      `SELECT * FROM memories ${where} ORDER BY importance DESC, accessed_at DESC LIMIT ? OFFSET ?`
    )
    .all(...values, limit, offset) as Record<string, unknown>[];

  return rows.map(deserializeMemory);
}

export function updateMemory(
  id: string,
  updates: {
    category?: MemoryCategory;
    title?: string;
    content?: string;
    tags?: string[];
    importance?: number;
  }
): Memory | null {
  const db = getDatabase();
  const existing = getMemory(id);
  if (!existing) return null;

  const category = updates.category ?? existing.category;
  const title = updates.title ?? existing.title;
  const content = updates.content ?? existing.content;
  const tags = updates.tags ?? existing.tags;
  const importance = updates.importance ?? existing.importance;
  const now = new Date().toISOString();

  const embedding = generateEmbedding(`${title} ${content}`);

  db.prepare(
    `UPDATE memories SET category = ?, title = ?, content = ?, tags = ?, importance = ?, embedding = ?, updated_at = ? WHERE id = ?`
  ).run(
    category,
    title,
    content,
    JSON.stringify(tags),
    importance,
    JSON.stringify(embedding),
    now,
    id
  );

  return getMemory(id);
}

export function deleteMemory(id: string): boolean {
  const db = getDatabase();
  const result = db.prepare("DELETE FROM memories WHERE id = ?").run(id);
  return result.changes > 0;
}

// ── Search ──

export function searchMemories(params: {
  query: string;
  project_id?: string;
  category?: MemoryCategory;
  tags?: string[];
  limit?: number;
  min_importance?: number;
}): SearchResult[] {
  const db = getDatabase();
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (params.project_id) {
    conditions.push("project_id = ?");
    values.push(params.project_id);
  }
  if (params.category) {
    conditions.push("category = ?");
    values.push(params.category);
  }
  if (params.min_importance) {
    conditions.push("importance >= ?");
    values.push(params.min_importance);
  }

  const where =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const rows = db
    .prepare(`SELECT * FROM memories ${where}`)
    .all(...values) as Record<string, unknown>[];

  const queryEmbedding = generateEmbedding(params.query);

  let results: SearchResult[] = rows
    .map((row) => {
      const memory = deserializeMemory(row);
      let score = 0;

      // Semantic similarity via embeddings
      if (memory.embedding && memory.embedding.length > 0) {
        score = cosineSimilarity(queryEmbedding, memory.embedding);
      }

      // Keyword boost
      const queryLower = params.query.toLowerCase();
      const titleLower = memory.title.toLowerCase();
      const contentLower = memory.content.toLowerCase();

      if (titleLower.includes(queryLower)) score += 0.3;
      if (contentLower.includes(queryLower)) score += 0.15;

      // Tag match boost
      if (params.tags && params.tags.length > 0) {
        const matchingTags = params.tags.filter((t) =>
          memory.tags.includes(t)
        );
        score += matchingTags.length * 0.1;
      }

      // Importance weight
      score *= 1 + memory.importance * 0.05;

      // Recency boost (decay over 30 days)
      const daysSinceAccess =
        (Date.now() - new Date(memory.accessed_at).getTime()) /
        (1000 * 60 * 60 * 24);
      score *= Math.exp(-daysSinceAccess / 30);

      return { memory, score };
    })
    .filter((r) => r.score > 0.001)
    .sort((a, b) => b.score - a.score);

  const limit = params.limit || 20;
  results = results.slice(0, limit);

  // Update access tracking for returned memories
  const updateStmt = db.prepare(
    `UPDATE memories SET accessed_at = datetime('now'), access_count = access_count + 1 WHERE id = ?`
  );
  for (const result of results) {
    updateStmt.run(result.memory.id);
  }

  return results;
}

// ── Stats ──

export function getStats(): { memory_count: number; project_count: number } {
  const db = getDatabase();
  const memoryCount = db
    .prepare("SELECT COUNT(*) as count FROM memories")
    .get() as { count: number };
  const projectCount = db
    .prepare("SELECT COUNT(*) as count FROM projects")
    .get() as { count: number };
  return {
    memory_count: memoryCount.count,
    project_count: projectCount.count,
  };
}

// ── Helpers ──

function deserializeMemory(row: Record<string, unknown>): Memory {
  return {
    id: row.id as string,
    project_id: row.project_id as string,
    category: row.category as MemoryCategory,
    title: row.title as string,
    content: row.content as string,
    tags: JSON.parse((row.tags as string) || "[]"),
    importance: row.importance as number,
    embedding: row.embedding ? JSON.parse(row.embedding as string) : null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    accessed_at: row.accessed_at as string,
    access_count: row.access_count as number,
  };
}
