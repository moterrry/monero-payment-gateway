FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache ttf-dejavu fontconfig

COPY package*.json ./

RUN npm ci --only=production

COPY src/ ./src/

RUN mkdir -p /app/data

ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "src/index.js"]