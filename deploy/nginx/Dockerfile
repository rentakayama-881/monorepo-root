FROM nginx:1.28-bookworm

RUN rm /etc/nginx/conf.d/default.conf

COPY aivalid.conf /etc/nginx/conf.d/aivalid.conf

EXPOSE 80 443

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -sf http://localhost/nginx-health || exit 1
