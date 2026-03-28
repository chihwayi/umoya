FROM node:20-slim

WORKDIR /app

RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm install

COPY services/medical-aid-demo-service ./services/medical-aid-demo-service

EXPOSE 3004

CMD ["node", "services/medical-aid-demo-service/src/server.js"]
