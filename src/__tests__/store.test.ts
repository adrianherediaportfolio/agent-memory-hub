import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";

// Use in-memory database for tests
let db: Database.Database;

beforeEach(() => {
  db = new Database(":memory:");
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS memories (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'general',
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      tags TEXT DEFAULT '[]',
      importance INTEGER NOT NULL DEFAULT 5,
      embedding TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      accessed_at TEXT NOT NULL DEFAULT (datetime('now')),
      access_count INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `);
});

describe("Projects", () => {
  it("should create a project", () => {
    const result = db
      .prepare(
        "INSERT INTO projects (id, name, description) VALUES (?, ?, ?)"
      )
      .run("test-id", "My Project", "A test project");
    expect(result.changes).toBe(1);

    const project = db
      .prepare("SELECT * FROM projects WHERE id = ?")
      .get("test-id") as Record<string, unknown>;
    expect(project.name).toBe("My Project");
    expect(project.description).toBe("A test project");
  });

  it("should enforce unique project names", () => {
    db.prepare(
      "INSERT INTO projects (id, name) VALUES (?, ?)"
    ).run("id1", "MyProject");
    expect(() => {
      db.prepare(
        "INSERT INTO projects (id, name) VALUES (?, ?)"
      ).run("id2", "MyProject");
    }).toThrow();
  });

  it("should list projects", () => {
    db.prepare("INSERT INTO projects (id, name) VALUES (?, ?)").run(
      "id1",
      "Project1"
    );
    db.prepare("INSERT INTO projects (id, name) VALUES (?, ?)").run(
      "id2",
      "Project2"
    );

    const projects = db.prepare("SELECT * FROM projects").all();
    expect(projects).toHaveLength(2);
  });

  it("should cascade delete memories when project deleted", () => {
    db.prepare("INSERT INTO projects (id, name) VALUES (?, ?)").run(
      "proj1",
      "TestProject"
    );
    db.prepare(
      "INSERT INTO memories (id, project_id, title, content) VALUES (?, ?, ?, ?)"
    ).run("mem1", "proj1", "Test Memory", "Content");

    db.prepare("DELETE FROM projects WHERE id = ?").run("proj1");

    const memories = db
      .prepare("SELECT * FROM memories WHERE project_id = ?")
      .all("proj1");
    expect(memories).toHaveLength(0);
  });
});

describe("Memories", () => {
  it("should create a memory", () => {
    db.prepare("INSERT INTO projects (id, name) VALUES (?, ?)").run(
      "proj1",
      "TestProject"
    );
    const result = db
      .prepare(
        `INSERT INTO memories (id, project_id, category, title, content, tags, importance)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        "mem1",
        "proj1",
        "architecture",
        "Use Repository Pattern",
        "We decided to use the repository pattern for data access.",
        '["architecture", "pattern"]',
        8
      );
    expect(result.changes).toBe(1);

    const memory = db
      .prepare("SELECT * FROM memories WHERE id = ?")
      .get("mem1") as Record<string, unknown>;
    expect(memory.title).toBe("Use Repository Pattern");
    expect(memory.category).toBe("architecture");
    expect(memory.importance).toBe(8);
  });

  it("should filter memories by category", () => {
    db.prepare("INSERT INTO projects (id, name) VALUES (?, ?)").run(
      "proj1",
      "TestProject"
    );
    db.prepare(
      "INSERT INTO memories (id, project_id, category, title, content) VALUES (?, ?, ?, ?, ?)"
    ).run("m1", "proj1", "bug", "Bug 1", "Content");
    db.prepare(
      "INSERT INTO memories (id, project_id, category, title, content) VALUES (?, ?, ?, ?, ?)"
    ).run("m2", "proj1", "architecture", "Arch 1", "Content");
    db.prepare(
      "INSERT INTO memories (id, project_id, category, title, content) VALUES (?, ?, ?, ?, ?)"
    ).run("m3", "proj1", "bug", "Bug 2", "Content");

    const bugs = db
      .prepare("SELECT * FROM memories WHERE category = ?")
      .all("bug");
    expect(bugs).toHaveLength(2);
  });

  it("should track access count", () => {
    db.prepare("INSERT INTO projects (id, name) VALUES (?, ?)").run(
      "proj1",
      "TestProject"
    );
    db.prepare(
      "INSERT INTO memories (id, project_id, title, content, access_count) VALUES (?, ?, ?, ?, 0)"
    ).run("mem1", "proj1", "Test", "Content");

    db.prepare(
      "UPDATE memories SET access_count = access_count + 1 WHERE id = ?"
    ).run("mem1");
    db.prepare(
      "UPDATE memories SET access_count = access_count + 1 WHERE id = ?"
    ).run("mem1");

    const memory = db
      .prepare("SELECT access_count FROM memories WHERE id = ?")
      .get("mem1") as { access_count: number };
    expect(memory.access_count).toBe(2);
  });
});
