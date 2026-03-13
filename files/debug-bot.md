---
description: |
  Debug a specific user-reported bot issue.
  Traces the full conversation flow to find root cause.
argument: Session ID or description of the issue
---

# /debug-bot Command — Issue Diagnosis

Issue: $ARGUMENTS

## Parallel Investigation (3 agents)

**Agent 1 — Retrieval Debug** (rag-architect)
Given the failing query:
1. Re-run retrieval and inspect top-10 chunks
2. Check retrieval scores — is relevant content in KB?
3. Check if chunking caused relevant content to split
4. Check metadata filters — are they too restrictive?
5. Output: retrieval diagnosis + fix recommendation

**Agent 2 — Prompt Debug** (prompt-engineer)
Analyze the prompt chain:
1. Reconstruct exact prompt sent to LLM
2. Check if retrieved context was actually useful
3. Identify if prompt instructions caused the bad response
4. Test 3 prompt variations to fix the issue
5. Output: root cause + recommended prompt fix

**Agent 3 — Log Analysis** (analytics-engineer)
Pull conversation analytics:
1. Find the session in conversation logs
2. Check response times, error codes, retries
3. Check if this is a pattern (multiple users affected)
4. Check feedback data around this query type
5. Output: frequency/impact assessment

## Root Cause Report
Synthesize findings → identify PRIMARY cause:
- [ ] KB gap (missing content)
- [ ] Retrieval failure (wrong chunks returned)
- [ ] Prompt issue (LLM misinterpretation)
- [ ] Infrastructure issue (timeout, API error)
- [ ] Edge case in user input

Output fix plan with estimated effort.
