# EXOFRONT — static game only (no Node, no DB). Separate Fly app from main Sift.
FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html /usr/share/nginx/html/
COPY weapon-editor.html /usr/share/nginx/html/
COPY bone-rig.html /usr/share/nginx/html/
COPY phaser.js /usr/share/nginx/html/
COPY styles/ /usr/share/nginx/html/styles/
COPY src/ /usr/share/nginx/html/src/
COPY assets/ /usr/share/nginx/html/assets/
COPY vendor/ /usr/share/nginx/html/vendor/
COPY poc/ /usr/share/nginx/html/poc/
COPY demos/ /usr/share/nginx/html/demos/

EXPOSE 8080
