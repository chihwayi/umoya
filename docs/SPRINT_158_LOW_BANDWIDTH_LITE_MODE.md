# Sprint 158 — Low-Bandwidth Lite Mode & USSD Data Entry Menus

**Sprint**: S158  
**Module**: Progressive Web App Offline Mode, Low-Bandwidth API Responses, USSD Structured Data Entry  
**Bundle version**: `2026.04.17.1`  
**Bundle ID**: `sprint158_low_bandwidth_lite`

## Objectives
Optimize MediCore for rural environments with limited or zero internet connectivity. This includes a "Lite Mode" for the EHR web app (caching/compression), Background Sync for offline data entry, and structured clinical USSD menus for CHWs using basic feature phones.

---

## 1. Database & Provisioning
- [x] Create `tenant-low-bandwidth-lite.statements.ts` with schemas for:
  - `offline_sync_queue`: Store POST/PUT operations while device is offline, with retry and conflict tracking.
  - `ussd_clinical_entries`: Store structured data captured via USSD (vitals, symptoms, referrals).
- [x] Register `sprint158_low_bandwidth_lite` in `database-provisioning.service.ts`.
- [x] Create TypeORM Entities in `services/ehr-service/src/lite/entities/`:
  - `OfflineSyncQueue`, `UssdClinicalEntry`.
- [x] Register entities in `TenantService`.

## 2. Low-Bandwidth Web Optimization (services/ehr-service)
- [x] Implement `LiteController` & `LiteService`:
  - `POST /lite/sync`: Bulk process queued offline operations.
  - `GET /lite/pending-sync/:deviceId`: Check status of queued items.
- [x] Enable Gzip/Brotli compression in `main.ts` using `compression` middleware.
- [x] Register `LiteModule` in `ehr.module.ts`.

## 3. PWA & Offline Support (ehr-frontend)
- [x] Implement Service Worker (`public/sw.js`):
  - Cache static assets (JS, CSS, Icons).
  - Intercept fetch requests to provide "Network First, then Cache" for API calls.
  - Handle `SyncManager` registration for background data upload.
- [x] Create `LiteModeToggle` component:
  - Header button to enable `X-Lite-Mode: 1` header on all requests.
  - Interceptor in `api.ts` to strip non-essential fields from JSON when Lite Mode is active.
- [x] Create `offlineQueue.ts` utility using IndexedDB:
  - Transparently queue POST requests if `navigator.onLine` is false.

## 4. USSD Clinical Data Entry (services/ehr-service)
- [x] Extend existing USSD handler in `at-messaging.service.ts`:
  - Add "5. CHW Menu (Clinical)" to main USSD root.
  - Implement sub-menus for:
    - **Vitals**: Capture Weight, Temp via numeric input.
    - **Symptoms**: 1/0 checklist for fever, cough, etc.
    - **Referrals**: Select facility and reason code.
- [x] Implement `ussd_clinical_entries` persistence:
  - Auto-trigger `LiteService.processUssdEntry()` to convert session data into patient records.

---

## Final Validation Checklist
- [x] Service Worker correctly registers in Chrome/Firefox
- [x] API requests include `X-Lite-Mode: 1` when toggled
- [x] USSD "Vitals" menu correctly formats JSON payload
- [x] Background Sync triggers when network returns online → synced to server
- [x] `provision-repair-all.sh` clean
- [x] `npx tsc --noEmit` — 0 errors
- [x] `npm run lint` — 0 errors
- [ ] Git committed: `feat: implement Sprint 158 — low-bandwidth lite mode, PWA offline sync, USSD data entry`
