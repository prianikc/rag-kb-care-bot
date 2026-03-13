# 🤖 RAG KB Care Bot — Claude Code Multi-Agent System

Полная система агентов, MCP-серверов и хуков для разработки RAG чат-бота поддержки.

---

## 🗂️ Структура

```
.claude/
├── CLAUDE.md               # Главный контекст проекта + routing rules
├── settings.json           # Конфигурация хуков
├── agents/                 # Специализированные субагенты
│   ├── rag-architect.md       # RAG pipeline & retrieval
│   ├── kb-ingestor.md         # Document ingestion pipeline
│   ├── prompt-engineer.md     # LLM prompt design
│   ├── security-auditor.md    # Security & privacy
│   ├── frontend-developer.md  # Chat UI & admin panel
│   ├── quality-checker.md     # Testing & RAGAS evaluation
│   └── analytics-engineer.md  # Metrics & monitoring
├── commands/               # Slash-команды для оркестрации
│   ├── feature.md             # /feature — полный цикл разработки
│   ├── kb-audit.md            # /kb-audit — аудит базы знаний
│   └── debug-bot.md           # /debug-bot — диагностика проблем
└── hooks/                  # Автоматизация через события
    ├── pre_secrets_guard.py   # Блокировка захардкоженных секретов
    ├── pre_edit_rag.py        # Предупреждение при изменении RAG
    ├── post_edit_lint.py      # Авто-линт после сохранения .py
    ├── stop_notify_slack.py   # Slack-уведомление о завершении
    └── README.md
```

---

## 👥 Агенты и их зоны ответственности

| Агент | Специализация | Когда использовать |
|-------|--------------|-------------------|
| `rag-architect` | RAG pipeline, retrieval, chunking | Любые изменения в retrieval/generation |
| `kb-ingestor` | Document parsing, ingestion, dedup | Добавление источников в KB |
| `prompt-engineer` | System prompts, templates, guardrails | Изменение поведения бота |
| `security-auditor` | Auth, secrets, prompt injection, PII | Перед любым PR |
| `frontend-developer` | Chat UI, admin panel, streaming | Изменения интерфейса |
| `quality-checker` | RAGAS metrics, tests, regression | QA перед деплоем |
| `analytics-engineer` | Metrics, dashboards, KB gaps | Мониторинг и аналитика |

---

## 🔌 MCP Серверы

### Обязательные
```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "."],
      "description": "Чтение/запись файлов проекта"
    },
    "postgres": {
      "command": "npx", 
      "args": ["-y", "@modelcontextprotocol/server-postgres"],
      "env": { "DATABASE_URL": "${DATABASE_URL}" },
      "description": "Прямые SQL-запросы к БД аналитики"
    },
    "brave-search": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-brave-search"],
      "env": { "BRAVE_API_KEY": "${BRAVE_API_KEY}" },
      "description": "Веб-поиск для обогащения базы знаний"
    }
  }
}
```

### Рекомендуемые
```json
{
  "github": {
    "description": "PR review, issue creation, branch management",
    "url": "https://mcp.github.com/sse"
  },
  "slack": {
    "description": "Уведомления команде, отчёты в каналы",
    "url": "npx @modelcontextprotocol/server-slack"
  },
  "redis": {
    "description": "Инспекция кеша, отладка сессий",
    "command": "npx @modelcontextprotocol/server-redis"
  },
  "qdrant": {
    "description": "Прямые операции с векторной БД",
    "url": "https://github.com/qdrant/mcp-server-qdrant"
  }
}
```

### Опциональные (для расширения KB)
```json
{
  "confluence": "Синхронизация документации из Confluence",
  "notion":     "Импорт из Notion workspace",
  "gdrive":     "Google Drive как источник документов"
}
```

---

## 🪝 Система хуков

| Хук | Событие | Действие |
|-----|---------|----------|
| `pre_secrets_guard` | До записи файла | 🔐 Блокирует API ключи в коде |
| `pre_edit_rag` | До записи RAG файлов | ⚠️ Требует подтверждения |
| `post_edit_lint` | После записи `.py` | ✅ Ruff + mypy + быстрые тесты |
| `stop_notify_slack` | При завершении задачи | 📢 Slack-уведомление команде |

---

## 🚀 Быстрый старт

### 1. Установка
```bash
# Скопируй папку .claude/ в корень проекта
cp -r .claude/ /path/to/rag-kb-care-bot/

# Установи зависимости для хуков
pip install ruff mypy requests python-dotenv
```

### 2. Настрой MCP в Claude Code
```bash
# Добавь в ~/.claude/claude_desktop_config.json
# (см. секцию MCP Серверы выше)
```

### 3. Используй команды
```bash
# Новая фича (полный цикл с агентами)
/feature "Добавить фильтрацию KB по категориям"

# Аудит базы знаний
/kb-audit

# Отладка проблемы
/debug-bot "Бот не отвечает на вопросы про возврат товара"
```

### 4. Параллельные агенты вручную
```
Запусти 3 агента параллельно:
- kb-ingestor: проиндексируй docs/policies/
- quality-checker: запусти RAGAS на golden dataset
- analytics-engineer: построй отчёт за последние 7 дней
```

---

## 📊 Параллелизация: когда и как

```
ПАРАЛЛЕЛЬНО (независимые домены):
┌─────────────────────────────────────────────┐
│ kb-ingestor  │ frontend-dev │ analytics-eng  │
│ (новые docs) │ (новый UI)   │ (дашборд)      │
└─────────────────────────────────────────────┘

ПОСЛЕДОВАТЕЛЬНО (зависимости):
rag-architect → kb-ingestor → quality-checker → deploy

ФОНОВО (не блокирующие):
[bg] quality-checker: RAGAS benchmark
[bg] analytics-engineer: weekly report
→ продолжай работу, результаты придут позже (Ctrl+B)
```
