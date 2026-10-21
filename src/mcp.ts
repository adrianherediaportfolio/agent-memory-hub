#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod/v3";
import { formatProjectContext } from "./context";
import {
  CreateMemorySchema,
  CreateProjectSchema,
  MemoryCategory,
  SearchQuerySchema,
  UpdateMemorySchema,
} from "./types";
import {
  createMemory,
  createProject,
  deleteMemory,
  getProject,
  listMemories,
  listProjects,
  searchMemories,
  updateMemory,
} from "./store";

function textResult(text: string, isError = false) {
  return {
    content: [{ type: "text" as const, text }],
    ...(isError ? { isError: true } : {}),
  };
}

function jsonResult(value: unknown) {
  return textResult(JSON.stringify(value, null, 2));
}

function errorResult(message: string) {
  return textResult(message, true);
}

export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "agent-memory-hub",
    version: "1.1.0",
  });

  server.registerTool(
    "list_projects",
    { description: "List all projects in the memory database." },
    async () => jsonResult(listProjects())
  );

  server.registerTool(
    "create_project",
    {
      description: "Create a project for organizing agent memories.",
      inputSchema: CreateProjectSchema,
    },
    async ({ name, description }) => {
      try {
        return jsonResult(createProject(name, description));
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unable to create project";
        if (message.includes("UNIQUE constraint")) {
          return errorResult("A project with this name already exists.");
        }
        return errorResult(message);
      }
    }
  );

  server.registerTool(
    "remember",
    {
      description: "Save a memory to a project.",
      inputSchema: CreateMemorySchema,
    },
    async (input) => {
      if (!getProject(input.project_id)) {
        return errorResult(`Unknown project: ${input.project_id}`);
      }
      return jsonResult(createMemory(input));
    }
  );

  server.registerTool(
    "recall",
    {
      description: "Search project memories and return ranked results.",
      inputSchema: SearchQuerySchema,
    },
    async (input) => {
      if (input.project_id && !getProject(input.project_id)) {
        return errorResult(`Unknown project: ${input.project_id}`);
      }
      const results = searchMemories(input).map(({ memory, score }) => ({
        ...memory,
        score,
      }));
      return jsonResult(results);
    }
  );

  server.registerTool(
    "get_context",
    {
      description: "Get a project's memories as formatted Markdown context.",
      inputSchema: z.object({
        project_id: z.string().uuid(),
        category: MemoryCategory.optional(),
        limit: z.number().int().min(1).max(100).optional(),
      }),
    },
    async ({ project_id, category, limit }) => {
      const project = getProject(project_id);
      if (!project) {
        return errorResult(`Unknown project: ${project_id}`);
      }
      const memories = listMemories({
        project_id,
        category,
        limit: limit ?? 10,
      });
      return textResult(formatProjectContext(project, memories));
    }
  );

  server.registerTool(
    "update_memory",
    {
      description: "Update a saved memory.",
      inputSchema: UpdateMemorySchema.extend({
        memory_id: z.string().uuid(),
      }),
    },
    async ({ memory_id, ...updates }) => {
      const memory = updateMemory(memory_id, updates);
      if (!memory) {
        return errorResult(`Unknown memory: ${memory_id}`);
      }
      return jsonResult(memory);
    }
  );

  server.registerTool(
    "forget",
    {
      description: "Delete a saved memory.",
      inputSchema: z.object({ memory_id: z.string().uuid() }),
    },
    async ({ memory_id }) => {
      if (!deleteMemory(memory_id)) {
        return errorResult(`Unknown memory: ${memory_id}`);
      }
      return textResult(`Deleted memory ${memory_id}.`);
    }
  );

  return server;
}

async function main(): Promise<void> {
  const server = createMcpServer();
  await server.connect(new StdioServerTransport());
}

if (require.main === module) {
  void main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
