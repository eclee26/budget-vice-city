FROM node:22-alpine
WORKDIR /app
COPY package.json server.mjs ./
COPY *.html *.js *.css ./
USER node
ENV NODE_ENV=production
EXPOSE 8000
CMD ["node", "server.mjs"]
