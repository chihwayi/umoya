FROM node:20-slim

WORKDIR /app

# Install build dependencies + PostgreSQL client tools for backup/restore jobs
RUN apt-get update && apt-get install -y python3 make g++ postgresql-client gzip && rm -rf /var/lib/apt/lists/*

# Copy root workspace files
COPY package.json package-lock.json ./

# Copy shared config package
COPY packages/config/package.json ./packages/config/
COPY packages/config/tsconfig.json ./packages/config/

# Copy service package
COPY services/tenant-service/package.json ./services/tenant-service/

# Install dependencies
RUN npm install --legacy-peer-deps

# Copy shared config source and build it
COPY packages/config ./packages/config
RUN npm run build -w @umoya/config

# Copy service source
COPY services/tenant-service ./services/tenant-service

# Build service
WORKDIR /app/services/tenant-service
RUN npm run build

EXPOSE 3001

CMD ["npm", "start"]
