FROM alpine:3.22 AS apk-src

FROM n8nio/n8n:latest

USER root

# Восстановить apk из vanilla Alpine для установки системных пакетов
COPY --from=apk-src /sbin/apk /sbin/apk
COPY --from=apk-src /etc/apk/ /etc/apk/

# Tesseract OCR + языковые данные (рус/англ) + poppler для PDF->PNG
RUN apk add --no-cache \
    tini \
    tesseract-ocr \
    tesseract-ocr-data-rus \
    tesseract-ocr-data-eng \
    poppler-utils \
    unrtf \
    antiword \
    && rm -f /sbin/apk

RUN mkdir -p /opt/custom-nodes && cd /opt/custom-nodes && npm init -y && \
    npm install pg pdf-parse mammoth xlsx officeparser

ENV NODE_PATH=/opt/custom-nodes/node_modules
USER node
