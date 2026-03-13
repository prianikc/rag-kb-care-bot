---
description: |
  Full feature development cycle for RAG care bot.
  Orchestrates: rag-architect → kb-ingestor → prompt-engineer → 
  frontend-developer → security-auditor → quality-checker in correct order.
argument: Feature description
---

# /feature Command — Full Feature Development

You are orchestrating a new feature for the RAG KB Care Bot.

Feature request: $ARGUMENTS

## Step 1: Architecture Review (Sequential)
Use the `rag-architect` subagent to:
- Assess if this feature requires RAG pipeline changes
- Design any new retrieval or generation components
- Output: architecture decision + affected files list

## Step 2: Parallel Implementation
Once architecture is approved, launch IN PARALLEL:

**If feature touches KB/ingestion:**
→ `kb-ingestor` agent: implement ingestion changes

**If feature touches prompts/LLM behavior:**
→ `prompt-engineer` agent: update prompt templates

**If feature touches UI:**
→ `frontend-developer` agent: build UI components

## Step 3: Security Review (Sequential, after impl)
Use `security-auditor` agent to review all changed files.
Block merge if any HIGH severity issues found.

## Step 4: Quality Gate (Sequential, after security)
Use `quality-checker` agent to:
- Run existing test suite
- Write new tests for the feature
- Verify RAGAS metrics not degraded

## Step 5: Analytics Setup (Parallel with Step 4)
Use `analytics-engineer` agent to:
- Add tracking events for new feature
- Update dashboards if needed

Report final status with: files changed, tests added, metrics impact.
