FROM node:20-alpine

WORKDIR /app

COPY app/package.json app/package-lock.json* ./
RUN npm install --omit=dev

COPY app/ ./

ENV NODE_ENV=production
ENV PORT=4050
ENV SITES_ROOT=/app/sites
ENV DATA_DIR=/app/data

EXPOSE 4050

HEALTHCHECK --interval=20s --timeout=5s --retries=6 --start-period=30s \
  CMD node -e "require('http').get('http://127.0.0.1:4050/health',r=>process.exit(r.statusCode>=200&&r.statusCode<500?0:1)).on('error',()=>process.exit(1));"

CMD ["node", "server.js"]
