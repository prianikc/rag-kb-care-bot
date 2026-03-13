#!/usr/bin/env python3
"""
stop_notify_slack.py — Stop hook
Отправляет Slack-уведомление когда Claude завершает длинную задачу.
Полезно при параллельных агентах — знаешь когда всё готово.
"""

import json
import sys
import os
import urllib.request
import urllib.error
from datetime import datetime

def send_slack(webhook_url: str, message: str, color: str = "good"):
    payload = {
        "attachments": [{
            "color": color,
            "text": message,
            "footer": "Claude Code — RAG KB Care Bot",
            "ts": int(datetime.now().timestamp())
        }]
    }
    
    data = json.dumps(payload).encode()
    req = urllib.request.Request(
        webhook_url,
        data=data,
        headers={"Content-Type": "application/json"}
    )
    
    try:
        urllib.request.urlopen(req, timeout=5)
    except urllib.error.URLError:
        pass  # Don't fail if Slack is unavailable

def main():
    hook_input = json.load(sys.stdin)
    
    # Only notify for non-trivial completions
    stop_hook_active = hook_input.get("stop_hook_active", False)
    
    # Get Slack webhook from env
    webhook_url = os.environ.get("SLACK_WEBHOOK_URL")
    if not webhook_url:
        sys.exit(0)  # Slack not configured
    
    transcript_path = hook_input.get("transcript_path", "")
    
    # Build notification
    message = (
        f"🤖 *Claude Code завершил задачу*\n"
        f"Проект: RAG KB Care Bot\n"
        f"Время: {datetime.now().strftime('%H:%M:%S')}\n"
    )
    
    if transcript_path:
        message += f"Лог: `{transcript_path}`"
    
    send_slack(webhook_url, message, color="good")
    sys.exit(0)

if __name__ == "__main__":
    main()
