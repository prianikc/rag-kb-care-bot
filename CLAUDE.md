# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

RAG KB Care Bot — a NestJS application that integrates with the MaxHub bot platform to provide a RAG (Retrieval-Augmented Generation) knowledge base. Users interact through a MaxHub chat bot to upload documents and ask questions, with answers powered by n8n workflows, GigaChat embeddings, and Qdrant vector search.

## Build & Development Commands

```bash
npm install                    # Install dependencies
npx nx build max-bot           # Build the application
npm run start:bot              # Start dev server (runs nx serve)
npx nx lint max-bot            # Lint the application
npx prisma migrate dev         # Run Prisma migrations
npx prisma generate            # Regenerate Prisma client
```

### Infrastructure (from devops/ directory)

```bash
cd devops && docker compose up -d          # Start PostgreSQL, Redis, Qdrant, n8n
cd devops && docker compose --profile deploy up -d  # Full stack including bot
```

Ports: PostgreSQL 18433, Redis 16379, Qdrant 16333/16334, n8n 5678, Bot 3010.

## Architecture

### Monorepo Structure (Nx + webpack)

- `apps/max-bot/` — Main NestJS bot application
- `libs/prisma/` — Prisma schema, migrations, and generated client
- `devops/` — Docker Compose, Dockerfiles, n8n workflow JSON files, Postgres init scripts

### NestJS Module Organization (`apps/max-bot/src/app/`)

- **MenuModule** (`menu/`) — Entry point for bot interactions, main menu navigation, message routing
- **KnowledgeBaseModule** (`knowledge-base/`) — Document upload flows and Q&A question handling
- **CommonModule** (`common/`) — Global interceptor (`BotContextInterceptor`), exception filter (`BotExceptionFilter`), context service
- **SharedServicesModule** (`shared/`) — Cross-cutting services: DB, Redis state, n8n API, file uploads

### Key Patterns

**State Machine via Redis**: User session state is stored in Redis (24h TTL) keyed by user ID. State determines which handler processes incoming messages (menu, upload, question, doc-management).

**MaxHub Bot Decorators**: Routing uses `@MaxAction`, `@MaxCommand`, `@MaxOn` decorators from `nestjs-max` to bind handlers to bot events and callback actions.

**OrgGuard**: A NestJS guard that ensures an Organization record exists for the MaxHub user before any action proceeds, auto-creating it if needed.

**BotContextInterceptor + CLS**: Uses `nestjs-cls` (continuation-local storage) to propagate bot context (user, chat, organization) through the request lifecycle without explicit parameter passing.

**Message Handler Registry**: `KnowledgeBaseService` maintains a map of flow states to handler classes that implement a common interface, dispatching incoming messages based on current user state.

### n8n Integration

The bot delegates heavy RAG operations to n8n via webhooks (`N8nApiService`):

- `/rag-upload` — Document parsing, chunking, embedding, and Qdrant indexing
- `/rag-question` — Semantic search against Qdrant + LLM answer generation
- `/rag-docs` — Document listing and deletion (including Qdrant cleanup)

Workflow JSON files live in `devops/n8n-workflows/`.

### Data Model (Prisma)

Four models: `Organization` (maps to MaxHub users), `Document` (uploaded files with status tracking: pending → indexing → ready/error), `DocumentChunk` (text chunks with Qdrant vector IDs), `RagQuery` (Q&A history with source references).

Schema: `libs/prisma/src/lib/prisma/schema.prisma`
Migrations: `libs/prisma/src/lib/prisma/migrations/`
Config: `prisma.config.ts` (root)

## Environment Variables

Required in `.env` at project root:
- `BOT_TOKEN` — MaxHub bot API token
- `DATABASE_URL` — PostgreSQL connection string (for Prisma)
- `PG_USER`, `PG_PASSWD`, `PG_DBNAME` — PostgreSQL credentials (for Docker)
- `REDIS_HOST`, `REDIS_PORT` — Redis connection
- `N8N_ENCRYPTION_KEY`, `N8N_WEBHOOK_URL`, `N8N_WEBHOOK_BASE_URL` — n8n configuration
- `GIGACHAT_CLIENT_ID`, `GIGACHAT_CLIENT_SECRET` — GigaChat API (embeddings/LLM)
- `YC_API_KEY` — Yandex Cloud API key
