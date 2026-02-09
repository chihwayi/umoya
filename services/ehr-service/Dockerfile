FROM node:18-slim

WORKDIR /app

# Install build dependencies for native modules
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Copy root workspace files
COPY package.json package-lock.json ./

# Copy shared config package
COPY packages/config/package.json ./packages/config/
COPY packages/config/tsconfig.json ./packages/config/

# Copy service package
COPY services/ehr-service/package.json ./services/ehr-service/

# Install dependencies
RUN npm install

# Copy shared config source and build it
COPY packages/config ./packages/config
RUN npm run build -w @medicore/config

# Copy service source
COPY services/ehr-service ./services/ehr-service

# Build service
WORKDIR /app/services/ehr-service
RUN npm run build

EXPOSE 3013

CMD ["npm", "start"]
