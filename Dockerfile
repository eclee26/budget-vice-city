FROM node:22-alpine
WORKDIR /app
COPY package.json server.mjs ./
COPY *.html *.js *.css ./
COPY assets ./assets
COPY vendor ./vendor
USER node
ENV NODE_ENV=production
EXPOSE 8000
CMD ["node", "server.mjs"]
