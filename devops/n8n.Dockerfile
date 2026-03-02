FROM n8nio/n8n:latest

USER root
RUN mkdir -p /opt/custom-nodes && cd /opt/custom-nodes && npm init -y && npm install pg pdf-parse mammoth xlsx
ENV NODE_PATH=/opt/custom-nodes/node_modules
USER node
