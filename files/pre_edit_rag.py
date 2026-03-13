#!/usr/bin/env python3
"""
pre_edit_rag.py — PreToolUse hook
Запускается ПЕРЕД записью файлов в backend/rag/
Предупреждает об изменении критических компонентов RAG pipeline.
"""

import json
import sys

def main():
    hook_input = json.load(sys.stdin)
    tool_name = hook_input.get("tool_name", "")
    tool_input = hook_input.get("tool_input", {})
    
    # Только для write_file / str_replace_editor
    if tool_name not in ["write_file", "str_replace_editor", "create_file"]:
        sys.exit(0)  # разрешаем
    
    file_path = tool_input.get("path", "")
    
    # Критические файлы RAG pipeline
    CRITICAL_RAG_FILES = [
        "backend/rag/retrieval",
        "backend/rag/ingestion/chunker",
        "backend/rag/generation",
        "backend/vector_db",
    ]
    
    is_critical = any(c in file_path for c in CRITICAL_RAG_FILES)
    
    if is_critical:
        # Возвращаем блокирующее сообщение (exit code 2 = block + show message)
        print(json.dumps({
            "decision": "block",
            "reason": (
                f"⚠️  CRITICAL RAG FILE: {file_path}\n"
                f"Изменение этого файла может нарушить retrieval pipeline.\n"
                f"Пожалуйста, используй агента `rag-architect` для ревью:\n"
                f"  → Запусти: /rag-review {file_path}\n"
                f"  → Или явно подтверди: 'Я понимаю риски, продолжи'"
            )
        }))
        sys.exit(2)  # block
    
    sys.exit(0)  # allow

if __name__ == "__main__":
    main()
