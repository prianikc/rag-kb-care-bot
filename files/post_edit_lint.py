#!/usr/bin/env python3
"""
post_edit_lint.py — PostToolUse hook
После записи Python файлов: запускает линтер и быстрые тесты.
"""

import json
import sys
import subprocess
import os

def main():
    hook_input = json.load(sys.stdin)
    tool_name = hook_input.get("tool_name", "")
    tool_input = hook_input.get("tool_input", {})
    
    if tool_name not in ["write_file", "str_replace_editor", "create_file"]:
        sys.exit(0)
    
    file_path = tool_input.get("path", "")
    
    if not file_path.endswith(".py"):
        sys.exit(0)
    
    results = []
    
    # 1. Ruff linter (fast)
    try:
        result = subprocess.run(
            ["ruff", "check", file_path, "--fix"],
            capture_output=True, text=True, timeout=10
        )
        if result.returncode != 0:
            results.append(f"🔴 Ruff lint issues:\n{result.stdout}")
        else:
            results.append(f"✅ Ruff: clean")
    except (subprocess.TimeoutExpired, FileNotFoundError):
        results.append("⚠️  Ruff not available, skipping lint")
    
    # 2. Type check if in critical paths
    TYPED_PATHS = ["backend/rag/", "backend/api/", "backend/kb/"]
    if any(p in file_path for p in TYPED_PATHS):
        try:
            result = subprocess.run(
                ["mypy", file_path, "--ignore-missing-imports"],
                capture_output=True, text=True, timeout=15
            )
            if result.returncode != 0:
                results.append(f"🔴 Type errors:\n{result.stdout}")
            else:
                results.append("✅ mypy: no type errors")
        except (subprocess.TimeoutExpired, FileNotFoundError):
            results.append("⚠️  mypy not available")
    
    # 3. Quick RAG tests if retrieval files changed
    if "backend/rag/" in file_path:
        try:
            result = subprocess.run(
                ["python", "-m", "pytest", "tests/unit/test_rag_quick.py", 
                 "-x", "-q", "--timeout=30"],
                capture_output=True, text=True, timeout=60,
                cwd=os.path.dirname(file_path)
            )
            if result.returncode != 0:
                results.append(f"🔴 RAG quick tests FAILED:\n{result.stdout[-500:]}")
            else:
                results.append("✅ RAG quick tests: passed")
        except (subprocess.TimeoutExpired, FileNotFoundError):
            results.append("⚠️  Tests skipped (timeout or not found)")
    
    if results:
        print("\n".join(results))
    
    sys.exit(0)  # never block, just inform

if __name__ == "__main__":
    main()
