---
description: |
  Comprehensive knowledge base health audit.
  Runs parallel analysis across all KB dimensions.
argument: Optional category filter (e.g. "faq" or "all")
---

# /kb-audit Command — Knowledge Base Health Check

Category filter: $ARGUMENTS (default: all)

Launch **4 parallel subagents** for comprehensive KB audit:

## Parallel Agents

**Agent 1 — Coverage Analyzer** (rag-architect)
Analyze retrieval logs from last 7 days:
- Find queries with low retrieval scores (< 0.6)
- Identify KB gaps (unanswered queries)
- Output: list of missing topics sorted by frequency

**Agent 2 — Quality Checker** (quality-checker)
Run RAGAS evaluation on golden dataset:
- Measure faithfulness, relevancy, recall, precision
- Flag any metric below target threshold
- Output: quality scorecard with degraded areas

**Agent 3 — Freshness Auditor** (kb-ingestor)
Check document freshness:
- List documents not updated in > 90 days
- Check if source URLs still valid
- Identify version conflicts between chunks
- Output: stale documents list with recommended actions

**Agent 4 — Security Scan** (security-auditor)
Scan KB for data issues:
- Detect PII in stored chunks
- Check access control integrity
- Verify no sensitive internal docs exposed
- Output: security issues with severity levels

## Synthesis
After all 4 agents complete, compile unified audit report:
1. Priority fixes (CRITICAL → HIGH → MEDIUM)
2. KB coverage gaps with suggested new articles
3. Stale documents to refresh
4. Security issues to remediate

Save report to `docs/kb-audit-{date}.md`
Notify team via Slack #care-bot-ops channel.
