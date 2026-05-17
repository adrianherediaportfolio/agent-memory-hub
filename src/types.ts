import { z } from "zod";

export const MemoryCategory = z.enum([
  "architecture",
  "pattern",
  "bug",
  "decision",
  "convention",
  "dependency",
  "api",
  "config",
  "general",
]);

export type MemoryCategory = z.infer<typeof MemoryCategory>;

export const CreateProjectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
});

export const UpdateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
});

export const CreateMemorySchema = z.object({
  project_id: z.string().uuid(),
  category: MemoryCategory.default("general"),
  title: z.string().min(1).max(500),
  content: z.string().min(1).max(50000),
  tags: z.array(z.string().max(100)).max(20).default([]),
  importance: z.number().int().min(1).max(10).default(5),
});

export const UpdateMemorySchema = z.object({
  category: MemoryCategory.optional(),
  title: z.string().min(1).max(500).optional(),
  content: z.string().min(1).max(50000).optional(),
  tags: z.array(z.string().max(100)).max(20).optional(),
  importance: z.number().int().min(1).max(10).optional(),
});

export const SearchQuerySchema = z.object({
  query: z.string().min(1).max(1000),
  project_id: z.string().uuid().optional(),
  category: MemoryCategory.optional(),
  tags: z.array(z.string()).optional(),
  limit: z.number().int().min(1).max(100).default(20),
  min_importance: z.number().int().min(1).max(10).optional(),
});

export interface Project {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface Memory {
  id: string;
  project_id: string;
  category: MemoryCategory;
  title: string;
  content: string;
  tags: string[];
  importance: number;
  embedding: number[] | null;
  created_at: string;
  updated_at: string;
  accessed_at: string;
  access_count: number;
}

export interface SearchResult {
  memory: Memory;
  score: number;
}

export interface HealthResponse {
  status: string;
  version: string;
  uptime: number;
  memory_count: number;
  project_count: number;
}
