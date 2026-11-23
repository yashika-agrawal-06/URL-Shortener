FROM redis:7-alpine
EXPOSE 6379
HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
  CMD redis-cli ping || exit 1
CMD ["redis-server", "--appendonly", "yes"]