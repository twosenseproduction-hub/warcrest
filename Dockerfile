# EXOFRONT/MOW — static runtime. Build React/Phaser assets, then serve with nginx.
FROM node:24-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY capacitor.config.ts tsconfig.json vite.config.ts ./
COPY client/ ./client/
COPY index.html ./
COPY assets/ ./assets/
COPY data/ ./data/
COPY src/ ./src/
COPY styles/ ./styles/

RUN npm run build

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/ /usr/share/nginx/html/

EXPOSE 8080
