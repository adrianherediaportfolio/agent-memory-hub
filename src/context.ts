import type { Memory, Project } from "./types";

export function formatProjectContext(
  project: Project,
  memories: Memory[]
): string {
  const contextLines = memories.map((memory) => {
    const tagStr =
      memory.tags.length > 0 ? ` [${memory.tags.join(", ")}]` : "";
    return `## ${memory.title} (${memory.category}, importance: ${memory.importance})${tagStr}\n${memory.content}`;
  });

  return `# Project: ${project.name}\n${project.description ? `> ${project.description}\n` : ""}\n${contextLines.join("\n\n---\n\n")}`;
}
