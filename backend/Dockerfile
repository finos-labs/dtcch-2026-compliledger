FROM node:20-slim

WORKDIR /app

COPY backend/package*.json ./

RUN npm ci --ignore-scripts && npm rebuild better-sqlite3

COPY backend/ .

RUN npm run build

EXPOSE 3001

CMD ["npm", "start"]
