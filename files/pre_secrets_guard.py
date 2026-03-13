#!/usr/bin/env python3
"""
pre_secrets_guard.py — PreToolUse hook  
Блокирует запись файлов с захардкоженными секретами/API ключами.
Критично для RAG бота — множество API ключей (LLM, векторная БД и тд).
"""

import json
import sys
import re

# Паттерны для обнаружения секретов
SECRET_PATTERNS = [
    (r'sk-[a-zA-Z0-9]{32,}', 'OpenAI API Key'),
    (r'sk-ant-[a-zA-Z0-9-]{32,}', 'Anthropic API Key'),
    (r'AKIA[A-Z0-9]{16}', 'AWS Access Key'),
    (r'(?:password|passwd|pwd)\s*=\s*["\'][^"\']{6,}["\']', 'Hardcoded Password'),
    (r'(?:secret|token)\s*=\s*["\'][^"\']{8,}["\']', 'Hardcoded Secret'),
    (r'postgresql://[^:]+:[^@]+@', 'DB Connection String with password'),
    (r'mongodb\+srv://[^:]+:[^@]+@', 'MongoDB URI with password'),
]

def main():
    hook_input = json.load(sys.stdin)
    tool_name = hook_input.get("tool_name", "")
    tool_input = hook_input.get("tool_input", {})
    
    if tool_name not in ["write_file", "str_replace_editor", "create_file"]:
        sys.exit(0)
    
    # Get file content
    content = tool_input.get("content", "") or tool_input.get("new_str", "")
    file_path = tool_input.get("path", "")
    
    # Skip .env files (secrets go there intentionally)
    if ".env" in file_path and ".env.example" not in file_path:
        sys.exit(0)
    
    # Skip test files with fake secrets
    if "test_" in file_path or "_test." in file_path:
        sys.exit(0)
    
    found_secrets = []
    for pattern, name in SECRET_PATTERNS:
        if re.search(pattern, content, re.IGNORECASE):
            found_secrets.append(name)
    
    if found_secrets:
        print(json.dumps({
            "decision": "block",
            "reason": (
                f"🔐 SECRETS DETECTED in {file_path}:\n"
                f"Found: {', '.join(found_secrets)}\n\n"
                f"Никогда не хардкодь секреты!\n"
                f"Используй:\n"
                f"  • .env файл + python-dotenv\n"
                f"  • os.environ['KEY_NAME']\n"
                f"  • AWS Secrets Manager / HashiCorp Vault\n\n"
                f"Пример: api_key = os.environ['OPENAI_API_KEY']"
            )
        }))
        sys.exit(2)  # block
    
    sys.exit(0)

if __name__ == "__main__":
    main()
