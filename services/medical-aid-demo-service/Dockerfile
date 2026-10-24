FROM node:20-slim

WORKDIR /app

# express has no native deps, so no build toolchain is needed here.
# Previously copied the ROOT monorepo's package.json/lockfile and ran
# npm install there — but this service has no package.json of its own and
# isn't in the root's own dependencies, only a transitive dep of
# ehr-service/tenant-service's package.json (which were never copied in),
# so `express` never actually installed. Install from this service's own
# package.json instead — the standard single-service Docker build pattern.
COPY services/medical-aid-demo-service/package.json ./
RUN npm install --omit=dev

COPY services/medical-aid-demo-service ./services/medical-aid-demo-service

EXPOSE 3004

CMD ["node", "services/medical-aid-demo-service/src/server.js"]
