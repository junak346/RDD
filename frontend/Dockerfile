# Frontend image: build with Vite, serve statically via nginx (proxying /api).
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
RUN mkdir -p /etc/nginx/snippets
# 00- prefix ensures the URI maps are parsed before default.conf references them.
COPY nginx-map.conf /etc/nginx/conf.d/00-rdd-map.conf
COPY nginx-headers.conf /etc/nginx/snippets/rdd-headers.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
