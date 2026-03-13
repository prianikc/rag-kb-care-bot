#!/usr/bin/env bash

# =============================================================================
# RAG KB Care Bot — Claude Code Multi-Agent Setup Script
# =============================================================================

set -e

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RED='\033[0;31m'; NC='\033[0m'
CHECK="${GREEN}✅${NC}"; WARN="${YELLOW}⚠️ ${NC}"; ERR="${RED}❌${NC}"; INFO="${CYAN}ℹ️ ${NC}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DST="$PROJECT_ROOT/.claude"

echo ""
echo -e "${BOLD}${BLUE}============================================================${NC}"
echo -e "${BOLD}${BLUE}   RAG KB Care Bot — Claude Code Multi-Agent Installer      ${NC}"
echo -e "${BOLD}${BLUE}============================================================${NC}"
echo ""
echo -e "${INFO} Папка скрипта : ${CYAN}$SCRIPT_DIR${NC}"
echo -e "${INFO} Корень проекта: ${CYAN}$PROJECT_ROOT${NC}"
echo -e "${INFO} Установка в   : ${CYAN}$DST${NC}"
echo ""

# =============================================================================
# Функция: найти файл в любом из переданных путей
# =============================================================================
find_src() {
    for f in "$@"; do
        [ -f "$f" ] && { echo "$f"; return 0; }
    done
    return 1
}

# =============================================================================
# Для каждого файла ищем ВО ВСЕХ возможных местах:
#   1) SCRIPT_DIR/subdir/filename  — файлы в подпапках
#   2) SCRIPT_DIR/filename         — все файлы плоско в корне (твой случай)
# =============================================================================

echo -e "${BOLD}🔍 Проверяем файлы...${NC}"
MISSING=0

check() {
    local label="$1"; shift
    if find_src "$@" > /dev/null 2>&1; then
        echo -e "  ${CHECK} $label"
    else
        echo -e "  ${ERR} $label НЕ НАЙДЕН"
        MISSING=1
    fi
}

check "settings.json"        "$SCRIPT_DIR/settings.json"
check "CLAUDE.md"            "$SCRIPT_DIR/CLAUDE.md"

check "rag-architect.md"     "$SCRIPT_DIR/agents/rag-architect.md"     "$SCRIPT_DIR/rag-architect.md"
check "kb-ingestor.md"       "$SCRIPT_DIR/agents/kb-ingestor.md"       "$SCRIPT_DIR/kb-ingestor.md"
check "prompt-engineer.md"   "$SCRIPT_DIR/agents/prompt-engineer.md"   "$SCRIPT_DIR/prompt-engineer.md"
check "security-auditor.md"  "$SCRIPT_DIR/agents/security-auditor.md"  "$SCRIPT_DIR/security-auditor.md"
check "frontend-developer.md" "$SCRIPT_DIR/agents/frontend-developer.md" "$SCRIPT_DIR/frontend-developer.md"
check "quality-checker.md"   "$SCRIPT_DIR/agents/quality-checker.md"   "$SCRIPT_DIR/quality-checker.md"
check "analytics-engineer.md" "$SCRIPT_DIR/agents/analytics-engineer.md" "$SCRIPT_DIR/analytics-engineer.md"

check "pre_secrets_guard.py" "$SCRIPT_DIR/hooks/pre_secrets_guard.py"  "$SCRIPT_DIR/pre_secrets_guard.py"
check "pre_edit_rag.py"      "$SCRIPT_DIR/hooks/pre_edit_rag.py"       "$SCRIPT_DIR/pre_edit_rag.py"
check "post_edit_lint.py"    "$SCRIPT_DIR/hooks/post_edit_lint.py"     "$SCRIPT_DIR/post_edit_lint.py"
check "stop_notify_slack.py" "$SCRIPT_DIR/hooks/stop_notify_slack.py"  "$SCRIPT_DIR/stop_notify_slack.py"

check "feature.md"           "$SCRIPT_DIR/commands/feature.md"         "$SCRIPT_DIR/feature.md"
check "kb-audit.md"          "$SCRIPT_DIR/commands/kb-audit.md"        "$SCRIPT_DIR/kb-audit.md"
check "debug-bot.md"         "$SCRIPT_DIR/commands/debug-bot.md"       "$SCRIPT_DIR/debug-bot.md"

echo ""

if [ "$MISSING" -eq 1 ]; then
    echo -e "${RED}${BOLD}Некоторые файлы не найдены.${NC}"
    echo ""
    echo -e "Содержимое папки скрипта:"
    ls -la "$SCRIPT_DIR"
    exit 1
fi

read -rp "$(echo -e ${YELLOW}"Установить в $PROJECT_ROOT? [y/N]: "${NC})" confirm
[[ "$confirm" == "y" || "$confirm" == "Y" ]] || { echo "Отменено."; exit 0; }
echo ""

# =============================================================================
# Копирование
# =============================================================================

copy_file() {
    local src="$1" dst="$2" label="$3"
    [ -f "$src" ] || { echo -e "  ${ERR} Источник не найден: $src"; return 1; }
    mkdir -p "$(dirname "$dst")"
    if [ -f "$dst" ]; then
        cp "$dst" "${dst}.bak"
        echo -e "  ${WARN} Перезаписан (резерв: $label.bak)"
    else
        echo -e "  ${CHECK} $label"
    fi
    cp "$src" "$dst"
}

# Копирует файл, ища его в нескольких возможных местах
copy_any() {
    local dst="$1" label="$2"; shift 2
    local src
    src=$(find_src "$@") || { echo -e "  ${ERR} Не найден: $label"; return 1; }
    copy_file "$src" "$dst" "$label"
}

# --- Папки ---
echo -e "${BOLD}📁 Создаём папки...${NC}"
for dir in "$DST" "$DST/agents" "$DST/commands" "$DST/hooks"; do
    if [ -d "$dir" ]; then
        echo -e "  ${WARN} Уже есть: ${dir#$PROJECT_ROOT/}"
    else
        mkdir -p "$dir"
        echo -e "  ${CHECK} ${dir#$PROJECT_ROOT/}"
    fi
done
echo ""

# --- CLAUDE.md ---
echo -e "${BOLD}📄 CLAUDE.md...${NC}"
copy_any "$PROJECT_ROOT/CLAUDE.md" "CLAUDE.md" \
    "$SCRIPT_DIR/CLAUDE.md"
echo ""

# --- settings.json ---
echo -e "${BOLD}📄 settings.json...${NC}"
copy_any "$DST/settings.json" ".claude/settings.json" \
    "$SCRIPT_DIR/settings.json"
echo ""

# --- Агенты ---
echo -e "${BOLD}🤖 Агенты...${NC}"
for name in rag-architect kb-ingestor prompt-engineer security-auditor frontend-developer quality-checker analytics-engineer; do
    copy_any "$DST/agents/${name}.md" "agents/${name}.md" \
        "$SCRIPT_DIR/agents/${name}.md" \
        "$SCRIPT_DIR/${name}.md"
done
echo ""

# --- Команды ---
echo -e "${BOLD}⌨️  Команды...${NC}"
for name in feature kb-audit debug-bot; do
    copy_any "$DST/commands/${name}.md" "commands/${name}.md" \
        "$SCRIPT_DIR/commands/${name}.md" \
        "$SCRIPT_DIR/${name}.md"
done
echo ""

# --- Хуки ---
echo -e "${BOLD}🪝 Хуки...${NC}"
for name in pre_secrets_guard pre_edit_rag post_edit_lint stop_notify_slack; do
    copy_any "$DST/hooks/${name}.py" "hooks/${name}.py" \
        "$SCRIPT_DIR/hooks/${name}.py" \
        "$SCRIPT_DIR/${name}.py"
done
# README хуков (опционально)
for candidate in "$SCRIPT_DIR/hooks/README.md" "$SCRIPT_DIR/README.md"; do
    [ -f "$candidate" ] && copy_file "$candidate" "$DST/hooks/README.md" "hooks/README.md" && break || true
done

chmod +x "$DST/hooks/"*.py 2>/dev/null \
    && echo -e "  ${CHECK} chmod +x для .py хуков" \
    || echo -e "  ${WARN} chmod пропущен (нормально на Windows)"
echo ""

# --- Зависимости ---
echo -e "${BOLD}🔍 Зависимости...${NC}"
check_cmd() {
    command -v "$1" &>/dev/null \
        && echo -e "  ${CHECK} $2: $($1 --version 2>/dev/null | head -1)" \
        || echo -e "  ${WARN} $2 не найден → ${CYAN}$3${NC}"
}
check_cmd claude  "Claude Code" "npm install -g @anthropic-ai/claude-code"
check_cmd python3 "Python"      "https://python.org"
check_cmd ruff    "ruff"        "pip install ruff"
check_cmd mypy    "mypy"        "pip install mypy"
check_cmd npx     "npx"         "nodejs.org"
echo ""

# --- .env ---
echo -e "${BOLD}🔑 .env...${NC}"
if [ -f "$PROJECT_ROOT/.env" ]; then
    echo -e "  ${CHECK} .env уже существует"
else
    cat > "$PROJECT_ROOT/.env.example" << 'EOF'
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=
DATABASE_URL=postgresql://user:password@localhost:5432/ragbot
REDIS_URL=redis://localhost:6379
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
BRAVE_API_KEY=
GITHUB_TOKEN=
EOF
    echo -e "  ${CHECK} Создан .env.example"
    echo -e "     ${YELLOW}Скопируй: cp .env.example .env  и заполни ключи${NC}"
fi
echo ""

# --- Итог ---
echo -e "${BOLD}${BLUE}============================================================${NC}"
echo -e "${BOLD}${GREEN}  🚀 Готово!${NC}"
echo -e "${BOLD}${BLUE}============================================================${NC}"
echo ""
echo -e "  CLAUDE.md"
echo -e "  .claude/"
echo -e "  ├── settings.json"
echo -e "  ├── agents/     $(ls "$DST/agents/" 2>/dev/null | wc -l | tr -d ' ') файлов"
echo -e "  ├── commands/   $(ls "$DST/commands/" 2>/dev/null | wc -l | tr -d ' ') файлов"
echo -e "  └── hooks/      $(ls "$DST/hooks/"*.py 2>/dev/null | wc -l | tr -d ' ') хука"
echo ""
echo -e "${BOLD}Следующие шаги:${NC}"
echo -e "  1. ${YELLOW}cp .env.example .env${NC}  — заполни API ключи"
echo -e "  2. ${YELLOW}cd \"$PROJECT_ROOT\" && claude${NC}  — запусти Claude Code"
echo -e "  3. Внутри Claude Code: ${YELLOW}/agents${NC}  — проверь агентов"
echo ""
echo -e "${BOLD}${GREEN}Удачной разработки! 🤖${NC}"
echo ""
