import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

describe("accessed_at timestamps", () => {
  const originalTz = process.env.TZ;
  let testDirectory: string;
  let dbPath: string;

  async function loadModules() {
    vi.resetModules();
    const [store, database] = await Promise.all([
      import("../store"),
      import("../database"),
    ]);
    return { store, database };
  }

  beforeEach(() => {
    // A zone west of UTC makes a local-time parse land in the future.
    process.env.TZ = "America/New_York";
    testDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), "agent-memory-hub-ts-")
    );
    dbPath = path.join(testDirectory, "test.db");
    process.env.DB_PATH = dbPath;
  });

  afterEach(() => {
    process.env.TZ = originalTz;
    fs.rmSync(testDirectory, { recursive: true, force: true });
  });

  it("stores accessed_at as ISO UTC on read and search", async () => {
    const { store, database } = await loadModules();
    const project = store.createProject("tz-project");
    const memory = store.createMemory({
      project_id: project.id,
      category: "general",
      title: "Timezone check",
      content: "accessed_at must be UTC",
      tags: [],
      importance: 5,
    });

    const readBack = store.getMemory(memory.id)!;
    expect(readBack.accessed_at).toMatch(ISO_UTC);
    expect(
      Math.abs(Date.now() - new Date(readBack.accessed_at).getTime())
    ).toBeLessThan(60_000);

    store.searchMemories({ query: "timezone", project_id: project.id });
    const afterSearch = store.getMemory(memory.id)!;
    expect(afterSearch.accessed_at).toMatch(ISO_UTC);
    database.closeDatabase();
  });

  it("migrates legacy SQLite timestamps to ISO UTC", async () => {
    let { database } = await loadModules();
    const db = database.getDatabase();
    db.prepare("INSERT INTO projects (id, name) VALUES (?, ?)").run(
      "p1",
      "legacy"
    );
    db.prepare(
      "INSERT INTO memories (id, project_id, title, content, accessed_at) VALUES (?, ?, ?, ?, ?)"
    ).run("m1", "p1", "Old", "Old row", "2026-11-04 06:10:00");
    database.closeDatabase();

    ({ database } = await loadModules());
    const row = database
      .getDatabase()
      .prepare("SELECT accessed_at FROM memories WHERE id = ?")
      .get("m1") as { accessed_at: string };
    expect(row.accessed_at).toBe("2026-11-04T06:10:00.000Z");
    database.closeDatabase();
  });
});
