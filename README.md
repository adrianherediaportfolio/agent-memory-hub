# Agent Memory Hub

> Self-hosted persistent memory system for AI coding agents. Agents remember context across sessions: architecture decisions, project patterns, resolved bugs.

![Node.js](https://img.shields.io/badge/Node.js-18%2B-green)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue)
![License](https://img.shields.io/badge/License-MIT-yellow)
![Version](https://img.shields.io/badge/Version-1.0.0-orange)

## Overview

Agent Memory Hub is a lightweight REST API that provides **persistent memory** for AI coding agents like Cursor, GitHub Copilot, Claude Code, and any MCP-compatible client. Instead of losing context between sessions, agents can store and retrieve:

- **Architecture decisions** — Why you chose a specific pattern or technology
- **Bug resolutions** — What caused a bug and how it was fixed
- **Project conventions** — Naming rules, code style, file structure
- **Dependency notes** — Known issues, version constraints, alternatives
- **API documentation** — Internal endpoints, external integrations

### Key Features

- **Semantic Search** — Find relevant memories using natural language queries with built-in TF-IDF embeddings
- **Project Isolation** — Organize memories by project for clean separation
- **Category System** — 9 built-in categories: architecture, pattern, bug, decision, convention, dependency, api, config, general
- **Importance Scoring** — Priority-based retrieval (1-10 scale)
- **Access Tracking** — Automatically tracks when memories are accessed and how often
- **Recency Decay** — Recent memories score higher in search results
- **Agent-Friendly Context Endpoint** — `/context/:project_id` returns formatted markdown perfect for LLM consumption
- **Zero External Dependencies** — Runs fully offline with SQLite and built-in embeddings (no OpenAI API needed)
- **Docker Ready** — One command deployment with persistent volumes

## Screenshots

### Health Check & API Response
![Health Check API](https://app.devin.ai/attachments/d02bccf6-e4f5-432e-819c-877fddaaafea/screenshot_2953a721fe8c41fab315f76951843de4.png)

### Search Example (curl)

```json
POST /api/v1/search
{
  "query": "auth middleware bug",
  "project_id": "uuid"
}

Response:
{
  "query": "auth middleware bug",
  "count": 1,
  "results": [{
    "category": "bug",
    "title": "Fixed null pointer in auth middleware",
    "content": "The JWT verification was failing silently when token was undefined...",
    "importance": 9,
    "relevance_score": 0.847
  }]
}
```

## Quick Start

### With Docker (recommended)

```bash
docker compose up -d
```

The API is now running at `http://localhost:3000`.

### Without Docker

```bash
# Install dependencies
npm install

# Build
npm run build

# Start
npm start
```

### Development

```bash
npm run dev    # Start with hot reload
npm test       # Run tests
npm run lint   # Lint code
```

## API Reference

Base URL: `http://localhost:3000/api/v1`

### Health Check

```bash
GET /health
```

Returns server status, version, uptime, and counts.

### Projects

```bash
# Create a project
POST /projects
{ "name": "my-web-app", "description": "React web application" }

# List all projects
GET /projects

# Get a project
GET /projects/:id

# Update a project
PUT /projects/:id
{ "name": "new-name", "description": "updated description" }

# Delete a project (cascades to memories)
DELETE /projects/:id
```

### Memories

```bash
# Create a memory
POST /memories
{
  "project_id": "uuid",
  "category": "architecture",
  "title": "Use Repository Pattern",
  "content": "We use the repository pattern for data access layer...",
  "tags": ["architecture", "pattern"],
  "importance": 8
}

# List memories (with optional filters)
GET /memories?project_id=uuid&category=bug&limit=20

# Get a memory (also tracks access)
GET /memories/:id

# Update a memory
PUT /memories/:id
{ "importance": 10 }

# Delete a memory
DELETE /memories/:id
```

### Search

```bash
# Semantic search across memories
POST /search
{
  "query": "authentication bug fix",
  "project_id": "uuid",
  "category": "bug",
  "tags": ["auth"],
  "limit": 10,
  "min_importance": 5
}
```

Returns memories ranked by relevance with `relevance_score`.

### Agent Context

```bash
# Get formatted context for an agent (markdown)
GET /context/:project_id

# Get structured JSON context
GET /context/:project_id
Accept: application/json
```

Returns all high-importance memories formatted as markdown, perfect for injecting into an LLM's system prompt.

## Memory Categories

| Category | Use Case |
|---|---|
| `architecture` | System design decisions, tech stack choices |
| `pattern` | Design patterns, code patterns used |
| `bug` | Bug reports and their resolutions |
| `decision` | Product/technical decisions with rationale |
| `convention` | Coding standards, naming rules |
| `dependency` | Package notes, version constraints |
| `api` | Internal/external API documentation |
| `config` | Configuration notes, environment setup |
| `general` | Anything else |

## Integration with AI Agents

### Cursor / Claude Code

Add to your `.cursorrules` or system prompt:

```
Before starting work, fetch project context:
GET http://localhost:3000/api/v1/context/{project_id}

After making important decisions or fixing bugs, save them:
POST http://localhost:3000/api/v1/memories
```

### MCP (Model Context Protocol)

Agent Memory Hub exposes a standard REST API that can be wrapped as an MCP server for any compatible client.

## Configuration

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Server port |
| `DB_PATH` | `./memory.db` | SQLite database file path |

## Tech Stack

- **Runtime**: Node.js 18+
- **Language**: TypeScript 5.6
- **Framework**: Express.js
- **Database**: SQLite (via better-sqlite3)
- **Embeddings**: Built-in TF-IDF (no external API)
- **Validation**: Zod
- **Testing**: Vitest + Supertest
- **Container**: Docker + Docker Compose

## License

MIT
