# Reviewer Checklist — MediCore AI-First Sprint Series

**Reviewer:** Claude (claude-sonnet-4-6)
**Process:** After implementing each sprint, run every item in this checklist. The sprint is DONE only when all items are checked.

---

## Universal Checklist (applies to every sprint)

### Database
- [ ] Provisioning bundle `id` is unique — does not exist anywhere else in `database-provisioning.service.ts`
- [ ] Bundle `version` format is `YYYY.MM.DD.N`
- [ ] Every `CREATE TABLE` uses `IF NOT EXISTS`
- [ ] Every `CREATE INDEX` uses `IF NOT EXISTS`
- [ ] Every `ALTER TABLE ADD COLUMN` uses `IF NOT EXISTS`
- [ ] `DO $$ BEGIN ... EXCEPTION WHEN undefined_table THEN NULL; END $$` used when table may not exist
- [ ] Provisioning bundle is placed INSIDE the `getProvisioningBundles()` return array
- [ ] After implementing, ran: `POST /admin-maintenance/tenants/repair-all` OR `provision-repair-all.sh` and it passes

### Backend (NestJS)
- [ ] All new services added to `providers: []` in `services/ehr-service/src/ehr.module.ts`
- [ ] All new controllers added to `controllers: []` in `services/ehr-service/src/ehr.module.ts`
- [ ] No `db.query()` call returns `{ rows: [...] }` — it returns plain array
- [ ] Patient portal controllers use `@UseGuards(PatientJwtAuthGuard)` and `req.patientId`
- [ ] Staff controllers use `@UseGuards(JwtAuthGuard)` and `req.tenantDb`
- [ ] No Bull queue imported or used in ehr-service
- [ ] `tsc --noEmit` passes in `services/ehr-service/`
- [ ] `npm run lint` passes in `services/ehr-service/`

### Frontend — EHR
- [ ] New components are imported and rendered (not just created but unused)
- [ ] No unused imports (TypeScript `noUnusedLocals`)
- [ ] `tsc --noEmit` passes in `ehr-frontend/`
- [ ] `npm run lint` passes in `ehr-frontend/`

### Frontend — Patient Portal
- [ ] New pages/components imported and routed
- [ ] Routes follow `/:tenantSlug/<resource>` pattern
- [ ] Protected routes wrapped in `<ProtectedRoute requireLinked>`
- [ ] `tsc --noEmit` passes in `patient-portal/`
- [ ] `npm run lint` passes in `patient-portal/`

### Mobile
- [ ] New screens registered in navigation stack
- [ ] Uses existing `api` client from `mobile/src/services/api.ts`
- [ ] All i18n keys added to ALL 8 locale files: `en, sn, nd, pt, fr, sw, zu, af`
- [ ] Uses only valid design tokens: `C.bg`, `C.blue`, `C.green`, `C.red`, `C.amber`, etc.
- [ ] Uses only valid icon names from `mobile/src/design/icons.ts`
- [ ] FONT tokens are FAMILY strings only (`FONT.ui`, `FONT.uiBd`, etc.) — NOT sizes
- [ ] `npx expo export --platform all` passes (no build errors)

### Tests
- [ ] Unit test spec file created under `src/services/` or `src/controllers/`
- [ ] All tests pass: `npm test` in `services/ehr-service/`
- [ ] No `.only` or `.skip` in test files

### Acceptance Criteria
- [ ] Every numbered acceptance criterion in the sprint doc has been manually verified
- [ ] Edge cases tested (empty data, CDSS unavailable, DB error)

---

## Sprint-Specific Review Notes

When reviewing a completed sprint, I will:
1. Run `grep -n "TODO\|FIXME\|stub\|placeholder\|setTimeout.*mock" <files>` to detect stubs
2. Verify the provisioning bundle actually runs by tailing `provision-repair-all.sh` output
3. Check that AI fallback is graceful (no 500 errors if CDSS is down)
4. Verify push notification reaches mobile (check FCM/Expo delivery log)
5. Confirm i18n keys exist in all 8 locale files

---

## Red Flags (auto-fail)

Any of these means the sprint is NOT done:

- `setTimeout(() => { resolve(mockData) }, 100)` — mock stub in production code
- `return { rows: [...] }` from `db.query()` — wrong DB API
- `req.user.sub` in a patient portal controller — must be `req.patientId`
- Missing bundle from `getProvisioningBundles()` return array
- Controller missing from `ehr.module.ts`
- i18n key added to only `en` locale
- `CREATE TABLE` without `IF NOT EXISTS`
