# RAG KB Care Bot

Чат-бот для MaxHub с базой знаний на основе RAG (Retrieval-Augmented Generation). Пользователи загружают документы и задают вопросы через чат — бот ищет ответы по векторной базе с помощью GigaChat и Qdrant.

---

## Стек технологий

NestJS, Nx, Prisma, PostgreSQL, Redis, Qdrant, n8n, GigaChat, Yandex Cloud Embeddings

## Архитектура

```
apps/max-bot/          — NestJS-приложение бота
libs/prisma/           — Prisma-схема, миграции, сгенерированный клиент
devops/                — Docker Compose, Dockerfiles, n8n-воркфлоу
```

**Модули бота** (`apps/max-bot/src/app/`):

- **MenuModule** — точка входа, навигация по меню, маршрутизация сообщений
- **KnowledgeBaseModule** — загрузка документов, обработка вопросов
- **CommonModule** — интерцептор контекста, фильтр исключений
- **SharedServicesModule** — БД, Redis-состояние, API n8n, загрузка файлов

**RAG-операции** делегируются в n8n через вебхуки:

- `/rag-upload` — парсинг, чанкинг, эмбеддинги, индексация в Qdrant
- `/rag-question` — семантический поиск + генерация ответа
- `/rag-docs` — список и удаление документов

## Требования

- Node.js >= 18
- Docker и Docker Compose

## Запуск инфраструктуры

```bash
  cd devops && docker compose up -d
```

Это поднимет PostgreSQL, Redis, Qdrant и n8n.

## Переменные окружения

Создайте файл `.env` в корне проекта (или скопируйте `.env.development`):

| Переменная | Описание |
|---|---|
| `BOT_TOKEN` | Токен бота MaxHub |
| `PORT` | Порт приложения (по умолчанию `3010`) |
| `PG_USER` | Пользователь PostgreSQL (для Docker) |
| `PG_PASSWD` | Пароль PostgreSQL (для Docker) |
| `PG_DBNAME` | Имя базы данных PostgreSQL (для Docker) |
| `DATABASE_URL` | Строка подключения PostgreSQL (для Prisma) |
| `REDIS_HOST` | Хост Redis |
| `REDIS_PORT` | Порт Redis |
| `N8N_ENCRYPTION_KEY` | Ключ шифрования n8n |
| `N8N_WEBHOOK_URL` | URL n8n |
| `N8N_WEBHOOK_BASE_URL` | Базовый URL вебхуков n8n |
| `GIGACHAT_CLIENT_ID` | Client ID GigaChat API |
| `GIGACHAT_CLIENT_SECRET` | Client Secret GigaChat API |
| `YC_API_KEY` | API-ключ Yandex Cloud (эмбеддинги) |
| `QDRANT_URL` | URL Qdrant |
| `NODE_ENV` | Окружение (`development` / `production`) |

## Команды разработки

```bash
  npm install                    # Установка зависимостей
  npx prisma generate            # Генерация Prisma-клиента
  npx prisma migrate dev         # Применение миграций
  npm run start:bot              # Запуск dev-сервера
  npx nx build max-bot           # Сборка приложения
  npx nx lint max-bot            # Линтинг
```

## Порты сервисов

| Сервис | Порт |
|---|---|
| Bot | 3010 |
| PostgreSQL | 18433 |
| Redis | 16379 |
| Qdrant (HTTP) | 16333 |
| Qdrant (gRPC) | 16334 |
| n8n | 5678 |

## Деплой

Полный стек включая бот:

```bash
  cd devops && docker compose --profile deploy up -d
```

---

# RAG KB Care Bot (English)

A MaxHub chat bot with a RAG (Retrieval-Augmented Generation) knowledge base. Users upload documents and ask questions via chat — the bot finds answers using vector search powered by GigaChat and Qdrant.

## Tech Stack

NestJS, Nx, Prisma, PostgreSQL, Redis, Qdrant, n8n, GigaChat, Yandex Cloud Embeddings

## Architecture

```
apps/max-bot/          — NestJS bot application
libs/prisma/           — Prisma schema, migrations, generated client
devops/                — Docker Compose, Dockerfiles, n8n workflows
```

**Bot modules** (`apps/max-bot/src/app/`):

- **MenuModule** — entry point, menu navigation, message routing
- **KnowledgeBaseModule** — document upload flows, question handling
- **CommonModule** — context interceptor, exception filter
- **SharedServicesModule** — DB, Redis state, n8n API, file uploads

**RAG operations** are delegated to n8n via webhooks:

- `/rag-upload` — parsing, chunking, embedding, Qdrant indexing
- `/rag-question` — semantic search + answer generation
- `/rag-docs` — document listing and deletion

## Prerequisites

- Node.js >= 18
- Docker and Docker Compose

## Infrastructure Setup

```bash
  cd devops && docker compose up -d
```

This starts PostgreSQL, Redis, Qdrant, and n8n.

## Environment Variables

Create a `.env` file at the project root (or copy `.env.development`):

| Variable | Description |
|---|---|
| `BOT_TOKEN` | MaxHub bot API token |
| `PORT` | Application port (default `3010`) |
| `PG_USER` | PostgreSQL user (for Docker) |
| `PG_PASSWD` | PostgreSQL password (for Docker) |
| `PG_DBNAME` | PostgreSQL database name (for Docker) |
| `DATABASE_URL` | PostgreSQL connection string (for Prisma) |
| `REDIS_HOST` | Redis host |
| `REDIS_PORT` | Redis port |
| `N8N_ENCRYPTION_KEY` | n8n encryption key |
| `N8N_WEBHOOK_URL` | n8n URL |
| `N8N_WEBHOOK_BASE_URL` | n8n webhook base URL |
| `GIGACHAT_CLIENT_ID` | GigaChat API client ID |
| `GIGACHAT_CLIENT_SECRET` | GigaChat API client secret |
| `YC_API_KEY` | Yandex Cloud API key (embeddings) |
| `QDRANT_URL` | Qdrant URL |
| `NODE_ENV` | Environment (`development` / `production`) |

## Development Commands

```bash
  npm install                    # Install dependencies
  npx prisma generate            # Generate Prisma client
  npx prisma migrate dev         # Run migrations
  npm run start:bot              # Start dev server
  npx nx build max-bot           # Build the application
  npx nx lint max-bot            # Lint
```

## Service Ports

| Service | Port |
|---|---|
| Bot | 3010 |
| PostgreSQL | 18433 |
| Redis | 16379 |
| Qdrant (HTTP) | 16333 |
| Qdrant (gRPC) | 16334 |
| n8n | 5678 |

## Deployment

Full stack including the bot:

```bash
  cd devops && docker compose --profile deploy up -d
```
