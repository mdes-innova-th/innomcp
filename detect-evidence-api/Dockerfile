FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production=false
COPY tsconfig.json ./
COPY src/ ./src/
RUN npx tsc
EXPOSE 3013
CMD ["node", "dist/src/index.js"]
