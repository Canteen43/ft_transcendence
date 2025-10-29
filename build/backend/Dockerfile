# ---- Stage 1: Build backend

FROM node:20 AS builder

WORKDIR /app

COPY ./package.json ./
COPY ./package-lock.json ./
COPY ./backend ./backend
COPY ./shared ./shared

RUN npm ci
RUN npm run build:backend
RUN rm -rf node_modules

# ---- Stage 2: Runtime

FROM node:20-alpine

WORKDIR /app

COPY ./package.json ./
COPY ./package-lock.json ./
RUN mkdir -p ./database
COPY ./database/baseline.sql ./database
COPY --from=builder /app/build/app/backend ./backend
COPY --from=builder /app/build/app/shared ./shared

RUN npm ci --omit=dev
EXPOSE 8080

CMD ["npm", "run", "start:backend"]
