# ---- Stage 1: Build backend

FROM node:20 AS builder

WORKDIR /app

COPY ./package.json ./
COPY ./package-lock.json ./
COPY ./frontend ./frontend
COPY ./shared ./shared

RUN npm ci
RUN npx vite build --config frontend/vite.config.ts
RUN rm -rf node_modules


# ---- Stage 2: Runtime

FROM nginx:latest

COPY --from=builder /app/frontend/dist /usr/share/nginx/html
COPY build/frontend/config.json /usr/share/nginx/html/config.json
COPY build/frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY build/frontend/launch.sh /etc/nginx/launch.sh


EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
