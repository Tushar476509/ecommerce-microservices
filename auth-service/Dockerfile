FROM node:20-alpine

RUN apk add --no-cache openssl

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY . .

RUN npm run build && chmod +x entrypoint.sh

EXPOSE 3001

CMD ["./entrypoint.sh"]
