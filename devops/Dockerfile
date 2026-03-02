FROM node:lts-alpine AS build
WORKDIR /app
COPY package*.json .
RUN npm ci
COPY . .
RUN npx prisma generate && npx nx build max-bot

FROM node:lts-alpine AS deploy
RUN addgroup --system ragkb && adduser --system -G ragkb ragkb
USER ragkb
WORKDIR /app
COPY --chown=ragkb:ragkb --from=build /app/dist/apps/max-bot/ ./
COPY --chown=ragkb:ragkb --from=build /app/node_modules/ node_modules/
COPY --chown=ragkb:ragkb --from=build /app/libs/prisma/ ./prisma/

ENV HOST=0.0.0.0
ENV PORT=3010
EXPOSE 3010
CMD ["node", "main.js"]
