# Sprint D — Offline-First & Sync (Section 3.8)

## 1. Sync model identified (code-read, full files)

Not CRDT, not LWW-by-design, not event-log — it is **store-and-forward
with per-op idempotency keys**:

- Mobile `services/offlineQueue.ts` (145 lines): POST/PATCH-only queue in
  encrypted storage, serialized mutations (`withQueueLock`), per-op stable
  `X-Client-Op-Id`, exponential backoff 30s→30m cap, **items never
  dropped**, poison items back off without blocking the queue.
- `hooks/useOfflineSync.ts` (128 lines): drains on app-active +
  online-restore; network failure mid-drain stops the run (no partial
  false-completion).
- Server `interceptors/idempotency.interceptor.ts` (+
  `offline-sync.service.ts`, `idempotency-key.entity.ts`,
  `sync-queue-log`): first execution stores the response keyed by op id;
  replays get the stored response. Documented v1 bound: two *concurrent*
  first attempts can both execute (unique index keeps one stored
  response) — sequential retries fully covered.
- Reads: `services/offlineCache.ts` — 6h TTL cache ("cover a full ward
  shift"); allergy safety `offlineAllergySafety.ts` — **fail-closed**
  (`blocked:true` when the cache is missing, positive).
- At rest: `secureLocalStorage.ts` — AES (`CryptoJS.AES`) over
  AsyncStorage with a random 256-bit key held in OS SecureStore/Keystore,
  never in AsyncStorage (positive design; note: CryptoJS string-passphrase
  mode uses EVP_BytesToKey MD5 derivation, not PBKDF2 — S4 hardening note,
  not a break).

## 2. Conflict tests (live, booted stack)

- **O-001 (S1, RUNTIME-PROVEN): silent last-write-wins on clinical data.**
  `updatePatient` = `Object.assign(dto)` + `save` — no version/etag/
  `updatedAt` precondition, no conflict signal anywhere in the path.
  Demonstrated on phone-less fixture `AUD-C-001`: device 2 wrote
  `allergies='Aspirin - rash'` (200); device 1 replayed a stale write
  `allergies='Penicillin - anaphylaxis'` (200); final state = stale value,
  no 409, no warning, no merge record. An allergy update was silently
  reverted by an older write. Cross-field merges work (different fields
  don't clobber), which makes the same-field silent loss harder to notice.
- **O-002 (S1, RUNTIME-PROVEN, interplay with S-004): the queue's
  never-drop promise meets a deterministic server 500.** Any queued PUT to
  a patient carrying phone/nationalId re-encrypts into `VARCHAR(50)` and
  fails forever — observed across 4 consecutive PUTs. `markAttempt` backs
  off and keeps the item: infinite backlog growth, one poisoned write per
  affected patient, and the offline edit the clinician believes is queued
  can never land. Offline-first is inoperative for the core entity until
  S-004 is fixed.
- **O-003 (POSITIVE, RUNTIME-PROVEN): idempotent replay works.**
  Same `X-Client-Op-Id` POSTed twice to the disclosure endpoint → second
  response byte-identical, same record id, `idempotency_keys` row persisted.
  Retried submissions after a lost response do not duplicate.

## 3. Offline coverage by workflow (code-read × live where noted)

| Workflow | Offline behavior | Evidence |
|---|---|---|
| Login | Requires network (JWT issuance server-side); cached JWT usable until expiry | code-read (`useAuthStore`, no offline-auth path found) |
| Chart view | 6h cache via `OfflineCache` | code-read; TTL expiry = hard miss, no stale-serve flag |
| Prescribe / orders | Queued as POST/PATCH, replayed with idempotency key | code-read + O-003 live |
| BCMA | No offline-specific path found | UNVERIFIED (not traced) |
| Drug-interaction check | **Abstains** (`abstained:true`) when the network fails | code-read (`cdss.ts:207-214`) |
| Allergy check | **Blocked** (fail-closed) when cache missing | code-read (positive) |
| QR scan | Requires network (server token lookup) | code-read |
| Herb-drug display | **Shows "No herb-drug interactions identified" when abstained** (O-004) | code-read, single occurrence verified |

- **O-004 (S2, code-read, all call sites checked): abstain/negative
  conflation.** `DoctorRoundsScreen.tsx:460-465` renders the
  no-interactions message when `abstained || interactions.length === 0`.
  Offline (or any CDSS failure) therefore presents *unknown* as *none* for
  herb–drug pairs — the highest-risk blind spot given traditional-medicine
  use. The exact render condition was executed in isolation
  (`abstained:true` vs genuinely-empty both render the message —
  indistinguishable); full-RN rendering needs an emulator (stated). The drug–drug path in `DoctorAIScreen.tsx:147-154` does the right
  thing ("AI unavailable… consult your formulary"), proving the safe
  pattern exists one screen away. `grep` confirms the herb message is the
  only occurrence — no wider variant. Live-RN rendering not executed
  (report-only harness has no emulator); the JSX conditional is
  unambiguous, verdict stays S2 with that stated boundary.
- Long-offline / large-backlog: bounded by analysis — backoff caps at 30m,
  items never drop, drain is sequential on reconnect; no backlog-size cap
  or prioritization (clinical-before-admin) found. With S-004 active, the
  backlog grows without bound on affected patients. No live 1000-op test
  run (time); stated as analysis, S3.
- Duplicate-MRN: `patientNumber` is server-generated with collision retry
  (code-read in `createPatient`); no local MRN reservation exists, so two
  offline registrations of the same person become two records pending
  back-office dedup (Sprint C MPI territory). UNVERIFIED live.

## 4. Cross-links

Sprint B tie-in: the confirmed-broken hard-stop (server-side interaction
blocking) has no offline equivalent at all — offline prescribing gets
neither the (broken) server check nor any client-side interaction base;
only the allergy cache stands between an offline prescriber and an
adverse pair, and only for previously-cached patients.
