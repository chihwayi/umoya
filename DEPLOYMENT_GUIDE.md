# MediCore Deployment Guide

This guide explains how to deploy MediCore using the standardized environment configuration.

## 1. Environment Configuration

The project now uses a single `.env` file to configure all services.

1. Copy the example configuration:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` to match your environment.
   - **Local Development**: The defaults in `.env.example` are set for local Docker development.
   - **Server Deployment**: Change the `URL` variables to your public domain/IP.

### Key Variables

| Variable | Description | Default (Local) |
|----------|-------------|-----------------|
| `REACT_APP_API_URL` | Auth/Tenant Service Public URL | `http://localhost:3001/api` |
| `REACT_APP_EHR_API_URL` | EHR Service Public URL | `http://localhost:3013/api` |
| `REACT_APP_WS_URL` | WebSocket Public URL | `ws://localhost:3014/ws` |
| `POSTGRES_PASSWORD` | Database Password | `medicore_password` |
| `JWT_SECRET` | JWT Signing Key | `ehr-super-secret-key` |

## 2. Docker Deployment

The `docker-compose.yml` file is configured to pick up variables from your `.env` file.

### Local Development
```bash
docker-compose up -d --build
```

### Server Deployment
1. Ensure your `.env` has the correct public URLs (e.g., `https://api.medicore.com`).
2. Run:
   ```bash
   docker-compose down
   docker-compose up -d --build
   ```

## 3. Troubleshooting

- **Hardcoded URLs**: If you see requests to `localhost` in a server environment, check that `REACT_APP_...` variables in `.env` are set correctly *before* building the images. Frontend apps bake these variables in at build time.
- **Ports**: If ports clash, change the `_PORT` variables in `.env`.

## 4. Updates

When pulling new code:
1. `git pull`
2. Check `.env.example` for new variables.
3. Update your `.env`.
4. Rebuild containers: `docker-compose up -d --build`
