import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("MCP server", () => {
  let testDirectory: string;
  let client: Client;
  let closeServer: () => Promise<void>;
  let closeDatabase: () => void;

  beforeEach(async () => {
    testDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), "agent-memory-hub-mcp-")
    );
    process.env.DB_PATH = path.join(testDirectory, "test.db");
    vi.resetModules();

    const [{ createMcpServer }, database] = await Promise.all([
      import("../mcp"),
      import("../database"),
    ]);
    closeDatabase = database.closeDatabase;

    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const server = createMcpServer();
    await server.connect(serverTransport);

    client = new Client({ name: "agent-memory-hub-test", version: "1.0.0" });
    await client.connect(clientTransport);
    closeServer = () => server.close();
  });

  afterEach(async () => {
    await client.close();
    await closeServer();
    closeDatabase();
    fs.rmSync(testDirectory, { recursive: true, force: true });
  });

  it("lists the registered tools", async () => {
    const result = await client.listTools();

    expect(result.tools.map((tool) => tool.name)).toEqual([
      "list_projects",
      "create_project",
      "remember",
      "recall",
      "get_context",
      "update_memory",
      "forget",
    ]);
  });

  it("creates, recalls, formats, updates, and forgets memories", async () => {
    const projectResult = await client.callTool({
      name: "create_project",
      arguments: { name: "MCP test project", description: "Test context" },
    });
    const project = JSON.parse(projectResult.content[0].text);
    const memoryResult = await client.callTool({
      name: "remember",
      arguments: {
        project_id: project.id,
        title: "Use safe migrations",
        content: "Apply additive database migrations before removing columns.",
        category: "decision",
        tags: ["sqlite", "migrations"],
        importance: 8,
      },
    });
    const memory = JSON.parse(memoryResult.content[0].text);

    const recallResult = await client.callTool({
      name: "recall",
      arguments: { query: "safe migrations", project_id: project.id },
    });
    const recalled = JSON.parse(recallResult.content[0].text);
    expect(recalled[0].id).toBe(memory.id);
    expect(recalled[0].score).toBeGreaterThan(0);

    const contextResult = await client.callTool({
      name: "get_context",
      arguments: { project_id: project.id },
    });
    expect(contextResult.content[0].text).toContain("# Project: MCP test project");
    expect(contextResult.content[0].text).toContain("Use safe migrations");

    const updateResult = await client.callTool({
      name: "update_memory",
      arguments: { memory_id: memory.id, title: "Use safe schema migrations" },
    });
    expect(JSON.parse(updateResult.content[0].text).title).toBe(
      "Use safe schema migrations"
    );

    const forgetResult = await client.callTool({
      name: "forget",
      arguments: { memory_id: memory.id },
    });
    expect(forgetResult.isError).toBeUndefined();

    const recallAfterForget = await client.callTool({
      name: "recall",
      arguments: { query: "safe migrations", project_id: project.id },
    });
    expect(JSON.parse(recallAfterForget.content[0].text)).toEqual([]);
  });

  it("returns a tool error for an unknown project", async () => {
    const result = await client.callTool({
      name: "remember",
      arguments: {
        project_id: "00000000-0000-0000-0000-000000000000",
        title: "Unknown project",
        content: "This should not be saved.",
      },
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Unknown project");
  });

  it("returns a tool error for an unknown memory", async () => {
    const result = await client.callTool({
      name: "forget",
      arguments: {
        memory_id: "00000000-0000-0000-0000-000000000000",
      },
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Unknown memory");
  });
});
