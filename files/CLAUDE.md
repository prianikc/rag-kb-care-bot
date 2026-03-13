# RAG Knowledge Base Care Bot — Claude Code Project Config

## Project Overview
This is a **RAG-powered customer care chatbot** with:
- Vector knowledge base (embeddings + retrieval)
- LLM-based answer generation with context
- Admin panel for knowledge base management
- Analytics & monitoring dashboard
- Multi-channel support (web, telegram, API)

## Tech Stack (assumed)
- **Frontend**: React/Next.js
- **Backend**: Python (FastAPI or similar)
- **Vector DB**: Chroma / Qdrant / Weaviate
- **LLM**: Claude API / OpenAI
- **Embeddings**: sentence-transformers / OpenAI embeddings
- **Database**: PostgreSQL
- **Cache**: Redis

## Sub-Agent Routing Rules

### Parallel dispatch (ALL conditions must be met):
- 3+ unrelated tasks or independent domains
- No shared state between tasks
- Clear file boundaries with no overlap

### Sequential dispatch (ANY condition triggers):
- Tasks have dependencies (B needs output from A)
- Shared files or state (risk of conflict)
- RAG pipeline changes (embeddings → retrieval → generation are sequential)

### Background dispatch:
- Embedding generation / re-indexing tasks
- Log analysis and monitoring
- Test runs that don't block implementation
- Documentation generation

## Core Principles
1. **Never modify vector DB schema without `rag-architect` agent review**
2. **All prompt changes must go through `prompt-engineer` agent**
3. **Security-sensitive code (auth, API keys) requires `security-auditor` review**
4. **KB ingestion pipeline changes require `kb-ingestor` agent**
5. **Run `quality-checker` before any PR**

## Project Structure
```
rag-kb-care-bot/
├── .claude/
│   ├── agents/          # Specialist sub-agents
│   ├── commands/        # Custom slash commands
│   └── hooks/           # Automation hooks
├── frontend/            # React/Next.js UI
├── backend/
│   ├── api/             # FastAPI routes
│   ├── rag/             # RAG pipeline
│   │   ├── ingestion/   # Document ingestion
│   │   ├── retrieval/   # Vector search
│   │   └── generation/  # LLM generation
│   ├── kb/              # Knowledge base management
│   └── analytics/       # Usage analytics
├── scripts/             # Utility scripts
├── tests/               # Test suites
└── docs/                # Documentation
```

## MCP Servers Connected
- **filesystem** — read/write project files
- **postgres** — query/modify database
- **redis** — cache inspection
- **github** — PR management, issues
- **slack** — team notifications
- **brave-search** — web research for KB enrichment
