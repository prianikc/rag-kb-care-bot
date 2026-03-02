#!/bin/bash
# Import n8n workflows into running n8n container
# Usage: ./import.sh

CONTAINER_NAME="rag-kb-n8n"

echo "Importing n8n workflows..."

for f in /home/node/workflows/*.json; do
  echo "Importing: $f"
  n8n import:workflow --input="$f"
done

echo "Done! Activate workflows in n8n UI: http://localhost:5678"
