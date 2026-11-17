FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY src ./src
RUN mkdir -p /data && chown -R node:node /app /data
ENV NODE_ENV=production
VOLUME ["/data"]
USER node
CMD ["npm", "start"]
