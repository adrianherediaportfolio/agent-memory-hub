FROM node:20-alpine AS builder

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

FROM node:20-alpine

WORKDIR /app
RUN apk add --no-cache tini
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY --from=builder /app/dist ./dist

RUN mkdir -p /data
ENV DB_PATH=/data/memory.db
ENV PORT=3000

EXPOSE 3000
VOLUME ["/data"]

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]
