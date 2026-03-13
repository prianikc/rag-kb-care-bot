COMPOSE_DIR := devops
COMPOSE := docker compose --env-file .env -f $(COMPOSE_DIR)/compose.yaml

## ---- Локальная инфраструктура (без бота) ----

.PHONY: local-up local-down local-clean local-restart local-logs local-ps

# Поднять инфраструктуру (PostgreSQL, Redis, Qdrant, n8n)
local-up:
	$(COMPOSE) up -d --build

# Остановить инфраструктуру (контейнеры сохраняются)
local-down:
	$(COMPOSE) down

# Полная очистка: удалить контейнеры, тома и образы
local-clean:
	$(COMPOSE) down -v --rmi local --remove-orphans

# Перезапуск инфраструктуры
local-restart: local-down local-up

# Логи всех сервисов (follow)
local-logs:
	$(COMPOSE) logs -f

# Статус контейнеров
local-ps:
	$(COMPOSE) ps

## ---- Полный стек (включая бота) ----

.PHONY: deploy-up deploy-down deploy-clean

# Поднять полный стек с ботом
deploy-up:
	$(COMPOSE) --profile deploy up -d --build

# Остановить полный стек
deploy-down:
	$(COMPOSE) --profile deploy down

# Полная очистка полного стека
deploy-clean:
	$(COMPOSE) --profile deploy down -v --rmi local --remove-orphans

## ---- Prisma ----

PRISMA_SCHEMA := libs/prisma/src/lib/prisma/schema.prisma

.PHONY: prisma-generate prisma-migrate prisma-migrate-dev prisma-studio

# Генерация Prisma-клиента
prisma-generate:
	npx prisma generate --schema $(PRISMA_SCHEMA)

# Применить миграции к БД (production-safe)
prisma-migrate:
	npx prisma migrate deploy --schema $(PRISMA_SCHEMA)

# Создать новую миграцию (dev)
prisma-migrate-dev:
	npx prisma migrate dev --schema $(PRISMA_SCHEMA)

# Prisma Studio (GUI)
prisma-studio:
	npx prisma studio --schema $(PRISMA_SCHEMA)

## ---- n8n ----

N8N_CONTAINER := rag-kb-n8n

.PHONY: n8n-import n8n-logs

# Импорт воркфлоу + credentials + активация (запускать после local-up / local-clean)
n8n-import:
	@echo "Импорт credentials в n8n..."
	@MSYS_NO_PATHCONV=1 docker exec $(N8N_CONTAINER) sh -c 'for f in /home/node/workflows/credentials/*.json; do echo "  $$f"; n8n import:credentials --input="$$f"; done'
	@echo "Импорт воркфлоу в n8n..."
	@MSYS_NO_PATHCONV=1 docker exec $(N8N_CONTAINER) sh -c 'for f in /home/node/workflows/*.json; do echo "  $$f"; n8n import:workflow --input="$$f"; done'
	@echo "Активация воркфлоу..."
	@MSYS_NO_PATHCONV=1 docker exec $(N8N_CONTAINER) sh -c 'for id in $$(n8n list:workflow 2>/dev/null | cut -d"|" -f1); do n8n update:workflow --id=$$id --active=true 2>/dev/null; done'
	@docker restart $(N8N_CONTAINER)
	@echo "Готово! Воркфлоу и credentials активны."

# Логи n8n
n8n-logs:
	docker logs -f $(N8N_CONTAINER)

## ---- Очистка данных ----

.PHONY: data-clean

# Очистка всех документов в БД и векторов в Qdrant (контейнеры остаются)
data-clean:
	@echo "Очистка таблиц документов в PostgreSQL..."
	@docker exec rag-kb-db sh -c 'psql -U "$$POSTGRES_USER" -d "$${POSTGRES_DB}_app" -c "TRUNCATE \"DocumentChunk\", \"Document\", \"Folder\", \"RagQuery\" CASCADE;"'
	@echo "Очистка коллекций Qdrant..."
	@bash -c 'for col in $$(curl -s http://localhost:16333/collections | grep -o "\"name\":\"[^\"]*\"" | sed "s/\"name\":\"//;s/\"//"); do echo "  Удаляю коллекцию $$col"; curl -s -X DELETE "http://localhost:16333/collections/$$col" > /dev/null; done'
	@echo "Готово!"
