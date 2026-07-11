# EXOFRONT — Warcrest / Verath (3D Three.js RTS). Vite build → static nginx.
# Stage 1: build the web app
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# materialize the assets symlink so Vite's publicDir copy is deterministic in-container
RUN rm -f web/public/assets && cp -r assets web/public/assets
RUN npm run build

# Stage 2: serve the built dist/
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
