# Agent Memory Hub

> Sistema self-hosted de memoria persistente para agentes de IA de desarrollo. Los agentes recuerdan el contexto entre sesiones: decisiones de arquitectura, patrones del proyecto, bugs resueltos.

![Node.js](https://img.shields.io/badge/Node.js-18%2B-green)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue)
![Licencia](https://img.shields.io/badge/Licencia-MIT-yellow)
![Version](https://img.shields.io/badge/Version-1.0.0-orange)

## Descripcion General

Agent Memory Hub es una API REST ligera que proporciona **memoria persistente** para agentes de IA de desarrollo como Cursor, GitHub Copilot, Claude Code y cualquier cliente compatible con MCP. En lugar de perder el contexto entre sesiones, los agentes pueden almacenar y recuperar:

- **Decisiones de arquitectura** — Por que elegiste un patron o tecnologia especifica
- **Resoluciones de bugs** — Que causo un bug y como se soluciono
- **Convenciones del proyecto** — Reglas de nomenclatura, estilo de codigo, estructura de archivos
- **Notas de dependencias** — Problemas conocidos, restricciones de version, alternativas
- **Documentacion de API** — Endpoints internos, integraciones externas

### Caracteristicas Principales

- **Busqueda Semantica** — Encuentra memorias relevantes usando lenguaje natural con embeddings TF-IDF integrados
- **Aislamiento por Proyecto** — Organiza memorias por proyecto para separacion limpia
- **Sistema de Categorias** — 9 categorias integradas: architecture, pattern, bug, decision, convention, dependency, api, config, general
- **Puntuacion de Importancia** — Recuperacion basada en prioridad (escala 1-10)
- **Seguimiento de Accesos** — Rastrea automaticamente cuando y cuantas veces se accede a cada memoria
- **Decaimiento por Tiempo** — Las memorias recientes obtienen mayor puntuacion en busquedas
- **Endpoint de Contexto para Agentes** — `/context/:project_id` devuelve markdown formateado perfecto para consumo de LLMs
- **Sin Dependencias Externas** — Funciona completamente offline con SQLite y embeddings integrados (no necesita API de OpenAI)
- **Docker Ready** — Despliegue con un solo comando con volumenes persistentes

## Capturas de Pantalla

### Health Check y Respuesta de API
![Health Check API](https://app.devin.ai/attachments/d02bccf6-e4f5-432e-819c-877fddaaafea/screenshot_2953a721fe8c41fab315f76951843de4.png)

### Ejemplo de Busqueda (curl)

```json
POST /api/v1/search
{
  "query": "auth middleware bug",
  "project_id": "uuid"
}

Respuesta:
{
  "query": "auth middleware bug",
  "count": 1,
  "results": [{
    "category": "bug",
    "title": "Fixed null pointer in auth middleware",
    "content": "The JWT verification was failing silently...",
    "importance": 9,
    "relevance_score": 0.847
  }]
}
```

## Inicio Rapido

### Con Docker (recomendado)

```bash
docker compose up -d
```

La API estara corriendo en `http://localhost:3000`.

### Sin Docker

```bash
# Instalar dependencias
npm install

# Compilar
npm run build

# Iniciar
npm start
```

### Desarrollo

```bash
npm run dev    # Iniciar con hot reload
npm test       # Ejecutar tests
npm run lint   # Verificar codigo
```

## Referencia de API

URL base: `http://localhost:3000/api/v1`

### Health Check

```bash
GET /health
```

Devuelve estado del servidor, version, uptime y conteos.

### Proyectos

```bash
# Crear un proyecto
POST /projects
{ "name": "mi-app-web", "description": "Aplicacion web React" }

# Listar todos los proyectos
GET /projects

# Obtener un proyecto
GET /projects/:id

# Actualizar un proyecto
PUT /projects/:id

# Eliminar un proyecto (elimina memorias en cascada)
DELETE /projects/:id
```

### Memorias

```bash
# Crear una memoria
POST /memories
{
  "project_id": "uuid",
  "category": "architecture",
  "title": "Usar Patron Repository",
  "content": "Usamos el patron repository para la capa de acceso a datos...",
  "tags": ["arquitectura", "patron"],
  "importance": 8
}

# Listar memorias (con filtros opcionales)
GET /memories?project_id=uuid&category=bug&limit=20

# Obtener una memoria (tambien rastrea acceso)
GET /memories/:id

# Actualizar una memoria
PUT /memories/:id

# Eliminar una memoria
DELETE /memories/:id
```

### Busqueda

```bash
# Busqueda semantica en memorias
POST /search
{
  "query": "fix de bug de autenticacion",
  "project_id": "uuid",
  "category": "bug",
  "limit": 10
}
```

Devuelve memorias ordenadas por relevancia con `relevance_score`.

### Contexto para Agentes

```bash
# Obtener contexto formateado para un agente (markdown)
GET /context/:project_id

# Obtener contexto JSON estructurado
GET /context/:project_id
Accept: application/json
```

## Categorias de Memoria

| Categoria | Uso |
|---|---|
| `architecture` | Decisiones de diseno de sistema, elecciones de stack |
| `pattern` | Patrones de diseno, patrones de codigo utilizados |
| `bug` | Reportes de bugs y sus resoluciones |
| `decision` | Decisiones de producto/tecnicas con justificacion |
| `convention` | Estandares de codigo, reglas de nomenclatura |
| `dependency` | Notas de paquetes, restricciones de version |
| `api` | Documentacion de API interna/externa |
| `config` | Notas de configuracion, setup de entorno |
| `general` | Todo lo demas |

## Stack Tecnologico

- **Runtime**: Node.js 18+
- **Lenguaje**: TypeScript 5.6
- **Framework**: Express.js
- **Base de datos**: SQLite (via better-sqlite3)
- **Embeddings**: TF-IDF integrado (sin API externa)
- **Validacion**: Zod
- **Testing**: Vitest + Supertest
- **Contenedor**: Docker + Docker Compose

## Licencia

MIT
