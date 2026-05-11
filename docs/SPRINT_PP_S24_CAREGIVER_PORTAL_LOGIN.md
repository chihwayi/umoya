# Sprint PP-S24 — Patient Portal: Caregiver / Guardian Portal Login

## Objective
Allow a caregiver or guardian who has been granted family access (via `patient_family_access` table) to log in with their own email/password and view a **read-only scoped view** of the patient's records. This is a separate authentication flow from the patient login. Caregivers cannot modify clinical records.

## Background
The `patient_family_access` table already exists with: `id`, `patient_id`, `proxy_name`, `proxy_email`, `proxy_phone`, `relationship`, `access_level`, `expires_at`, `is_active`, `created_at`.

What is missing:
- A `password_hash` column on `patient_family_access` so caregivers can authenticate
- A backend endpoint `POST /patient-portal/caregiver/login`
- A backend endpoint `POST /patient-portal/caregiver/set-password` (for onboarding the caregiver after being granted access)
- A `CaregiverAuthContext` in the patient portal
- `CaregiverLoginPage.tsx`
- `CaregiverDashboard.tsx` with a read-only scoped view

## Database Changes — REQUIRED

### Per-Tenant Table Modification (`patient_family_access`)
Add provisioning bundle to `getProvisioningBundles()` in `services/tenant-service/src/services/database-provisioning.service.ts`:

```typescript
{
  id: 'patientFamilyAccessPasswordColumn',
  label: 'Patient family access password column',
  version: '2026.05.11.1',
  description: 'Adds password_hash column to patient_family_access for caregiver portal login',
  statements: () => [
    `ALTER TABLE patient_family_access
     ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255) NULL,
     ADD COLUMN IF NOT EXISTS password_set_at TIMESTAMPTZ NULL,
     ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ NULL`,
    `CREATE INDEX IF NOT EXISTS idx_family_access_proxy_email
     ON patient_family_access(proxy_email) WHERE is_active = true`,
  ],
},
```

**After adding this bundle, run:** `POST /admin-maintenance/tenants/repair-all`

## Backend Changes

### `services/ehr-service/src/controllers/patient-portal.controller.ts`

Add two new endpoints:

#### 1. `POST /patient-portal/caregiver/set-password`
Called after a caregiver is granted access. No auth guard — uses a time-limited invitation token approach. For simplicity in this sprint, accept `proxyEmail` + `invitationToken` (which is the family access `id` as UUID — the patient shares this with the caregiver) + `newPassword`.

```typescript
@Post('caregiver/set-password')
@ApiOperation({ summary: 'Set caregiver portal password using invitation token (family access ID)' })
async setCaregiverPassword(
  @Body() body: { invitationToken: string; proxyEmail: string; newPassword: string },
  @Req() req: any,
): Promise<{ message: string }> {
  if (!body.invitationToken || !body.proxyEmail || !body.newPassword) {
    throw new BadRequestException('invitationToken, proxyEmail, and newPassword are required');
  }
  if (body.newPassword.length < 8) {
    throw new BadRequestException('Password must be at least 8 characters');
  }
  const db = req.tenantDb;
  const grant = await db.query(
    `SELECT id, proxy_email FROM patient_family_access
     WHERE id = $1 AND proxy_email = $2 AND is_active = true`,
    [body.invitationToken, body.proxyEmail],
  );
  if (!grant.rows.length) throw new NotFoundException('Invitation not found or expired');
  const bcrypt = require('bcrypt');
  const hash = await bcrypt.hash(body.newPassword, 12);
  await db.query(
    `UPDATE patient_family_access SET password_hash = $1, password_set_at = NOW() WHERE id = $2`,
    [hash, body.invitationToken],
  );
  return { message: 'Password set successfully. You can now log in.' };
}
```

#### 2. `POST /patient-portal/caregiver/login`
```typescript
@Post('caregiver/login')
@ApiOperation({ summary: 'Caregiver portal login using family access credentials' })
async caregiverLogin(
  @Body() body: { email: string; password: string },
  @Req() req: any,
): Promise<{ token: string; caregiver: object; patient: object }> {
  if (!body.email || !body.password) {
    throw new BadRequestException('email and password are required');
  }
  const db = req.tenantDb;
  const result = await db.query(
    `SELECT fa.id, fa.proxy_name, fa.proxy_email, fa.relationship, fa.access_level,
            fa.password_hash, fa.expires_at, fa.is_active,
            p.id as patient_id, p.patient_number, p.first_name, p.last_name
     FROM patient_family_access fa
     JOIN patients p ON p.id = fa.patient_id
     WHERE fa.proxy_email = $1
       AND fa.is_active = true
       AND (fa.expires_at IS NULL OR fa.expires_at > NOW())
       AND fa.password_hash IS NOT NULL`,
    [body.email],
  );
  if (!result.rows.length) throw new UnauthorizedException('Invalid credentials or access expired');
  const grant = result.rows[0];
  const bcrypt = require('bcrypt');
  const valid = await bcrypt.compare(body.password, grant.password_hash);
  if (!valid) throw new UnauthorizedException('Invalid credentials');
  const jwtService = req.app.get('JwtService') || this.jwtService;
  const token = jwtService.sign({
    sub: grant.id,
    type: 'caregiver',
    patientId: grant.patient_id,
    tenantId: req.tenantId,
    accessLevel: grant.access_level,
  }, { expiresIn: '8h' });
  await db.query(
    `UPDATE patient_family_access SET last_login_at = NOW() WHERE id = $1`,
    [grant.id],
  );
  return {
    token,
    caregiver: {
      id: grant.id,
      name: grant.proxy_name,
      email: grant.proxy_email,
      relationship: grant.relationship,
      accessLevel: grant.access_level,
    },
    patient: {
      id: grant.patient_id,
      patientNumber: grant.patient_number,
      firstName: grant.first_name,
      lastName: grant.last_name,
    },
  };
}
```

Add `JwtService` to the constructor if not already present:
```typescript
constructor(
  // ... existing injections ...
  private readonly jwtService: JwtService,  // add this if missing
) {}
```
Import `JwtService` from `@nestjs/jwt` if not already imported.
Import `UnauthorizedException` from `@nestjs/common` if not already imported.

#### 3. `GET /patient-portal/caregiver/patient-summary`
A read-only summary endpoint for the caregiver dashboard. Uses a new `CaregiverJwtGuard` (or simply decode the token type in the existing guard). For simplicity, create a lightweight guard inline:

```typescript
@Get('caregiver/patient-summary')
@UseGuards(JwtAuthGuard)  // reuse existing guard — caregiver token has tenantId embedded
@ApiOperation({ summary: 'Get patient summary for caregiver view' })
async caregiverPatientSummary(@Req() req: any): Promise<any> {
  // Token sub is the family_access id, patientId is in the token payload
  const payload = req.user; // JwtAuthGuard already decodes this
  if (payload.type !== 'caregiver') throw new UnauthorizedException('Caregiver token required');
  const db = req.tenantDb;
  // Read-only summary: appointments, recent vitals, prescriptions, lab results
  const [appts, vitals, prescriptions] = await Promise.all([
    db.query(`SELECT id, appointment_date, reason, status FROM appointments WHERE patient_id = $1 AND appointment_date >= NOW() ORDER BY appointment_date ASC LIMIT 5`, [payload.patientId]),
    db.query(`SELECT id, recorded_at, systolic_bp, diastolic_bp, heart_rate, temperature, oxygen_saturation FROM vitals WHERE patient_id = $1 ORDER BY recorded_at DESC LIMIT 3`, [payload.patientId]),
    db.query(`SELECT id, medication_name, dosage, frequency, status FROM prescriptions WHERE patient_id = $1 AND status = 'active' LIMIT 10`, [payload.patientId]),
  ]);
  return {
    appointments: appts.rows,
    recentVitals: vitals.rows,
    activePrescriptions: prescriptions.rows,
  };
}
```

## Frontend Changes

### NEW: `patient-portal/src/contexts/CaregiverAuthContext.tsx`
Separate auth context for caregivers. Stores in localStorage keys: `caregiver_token`, `caregiver_data`, `caregiver_patient`, `caregiver_tenant`.

```typescript
interface CaregiverData {
  id: string;
  name: string;
  email: string;
  relationship: string;
  accessLevel: string;
}
interface PatientSummaryData {
  id: string;
  patientNumber: string;
  firstName: string;
  lastName: string;
}
interface CaregiverAuthContextType {
  caregiver: CaregiverData | null;
  patient: PatientSummaryData | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string, tenantSlug: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
}
```

On mount: load from localStorage, decode JWT exp (same `_decodeJwtExp` logic as `PatientAuthContext`), redirect to `/${slug}/caregiver/login` if expired.

`logout()`: clear all three localStorage keys, redirect to `/${localStorage.getItem('caregiver_tenant') || 'login'}/caregiver/login`.

### NEW: `patient-portal/src/pages/CaregiverLoginPage.tsx`
Route: `/:tenantSlug/caregiver/login`

**Page shell**: `min-h-screen bg-gradient-to-br from-pink-50 via-white to-rose-50`
(Pink/rose accent to visually distinguish caregiver portal from patient portal's blue/indigo)

**Card**: `max-w-md mx-auto px-4 py-20`
```
bg-white rounded-3xl shadow-xl border border-gray-200 p-8
```

**Header**:
- Icon: `w-16 h-16 bg-gradient-to-br from-pink-500 to-rose-600 rounded-2xl flex items-center justify-center shadow-lg mx-auto mb-6`
  Inside: `<Users className="w-8 h-8 text-white" />`
- Title: "Caregiver Portal" (text-2xl font-bold text-gray-900 text-center)
- Subtitle: `Caring for: {tenantName if available, else tenantSlug}` (text-sm text-gray-500 text-center mt-1)

**Form fields:**
- Email: standard input with `Mail` icon
- Password: standard input with `Lock` icon + show/hide toggle
- Submit button: `w-full bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white font-semibold py-3 rounded-xl`
  Label: "Sign in as Caregiver"

**Link below form**: "Need to set up your password?" → `/${tenantSlug}/caregiver/set-password`
**Link below form**: "Are you a patient?" → `/${tenantSlug}/login`

Error display: red pill banner `bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm`

### NEW: `patient-portal/src/pages/CaregiverSetPasswordPage.tsx`
Route: `/:tenantSlug/caregiver/set-password`

Simple form to onboard a new caregiver:
- **Invitation Token** field — labelled "Invitation code (Family Access ID shared by the patient)" — text input
- **Your Email** field
- **New Password** + **Confirm Password** fields with strength indicator
- Submit → calls `POST /patient-portal/caregiver/set-password`
- On success: redirect to `/${tenantSlug}/caregiver/login` with a toast "Password set! You can now log in."

```
min-h-screen bg-gradient-to-br from-pink-50 via-white to-rose-50
```
Same card style as CaregiverLoginPage.

### NEW: `patient-portal/src/pages/CaregiverDashboard.tsx`
Route: `/:tenantSlug/caregiver/dashboard`
Requires `CaregiverProtectedRoute` (see below).

**Page shell**: `min-h-screen bg-gradient-to-br from-pink-50 via-white to-rose-50`
**Header**: same sticky style but with pink accent
- Logo: `from-pink-500 to-rose-600` gradient
- Title: "Caring for {patient.firstName} {patient.lastName}"
- Subtitle: "{caregiver.relationship} — {caregiver.accessLevel} access"
- Logout button (top right)

**Access Level Banner**: show a read-only notice:
```
bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-2
<AlertCircle className="w-4 h-4 text-amber-600" />
<span className="text-sm text-amber-700">You have read-only access to {patient.firstName}'s health information.</span>
```

**Summary cards** (fetched from `GET /patient-portal/caregiver/patient-summary`):

1. **Upcoming Appointments card** (`bg-white rounded-2xl shadow-sm border border-gray-200 p-5`)
   - Header: `Calendar` icon + "Upcoming Appointments" title (text-blue-600)
   - List appointments with date, reason, status pill

2. **Recent Vitals card** (`bg-white rounded-2xl shadow-sm border border-gray-200 p-5`)
   - Header: `Activity` icon + "Recent Vitals" (text-red-600)
   - Latest BP, heart rate, temperature, O2 sat in a 2×2 grid of metric tiles

3. **Active Medications card** (`bg-white rounded-2xl shadow-sm border border-gray-200 p-5`)
   - Header: `Pill` icon + "Active Medications" (text-purple-600)
   - List medication name, dosage, frequency

**No edit/create buttons** — all data is read-only display. No navigation to booking, messaging, or payment.

### NEW: `patient-portal/src/components/CaregiverProtectedRoute.tsx`
```typescript
const CaregiverProtectedRoute: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading } = useCaregiverAuth();
  const { tenantSlug } = useParams();
  if (loading) return <LoadingSpinner />;
  if (!isAuthenticated) return <Navigate to={`/${tenantSlug}/caregiver/login`} replace />;
  return <>{children}</>;
};
```

### MODIFY: `patient-portal/src/App.tsx`
Add routes:
```tsx
<Route path="/:tenantSlug/caregiver/login" element={<CaregiverLoginPage />} />
<Route path="/:tenantSlug/caregiver/set-password" element={<CaregiverSetPasswordPage />} />
<Route
  path="/:tenantSlug/caregiver/dashboard"
  element={
    <CaregiverProtectedRoute>
      <CaregiverDashboard />
    </CaregiverProtectedRoute>
  }
/>
```
Wrap the entire app in both `PatientAuthProvider` and `CaregiverAuthProvider`:
```tsx
<PatientAuthProvider>
  <CaregiverAuthProvider>
    <Router>...</Router>
  </CaregiverAuthProvider>
</PatientAuthProvider>
```

### MODIFY: `patient-portal/src/pages/PatientDashboard.tsx`
In the `advancedFeatures` section or a new "For Caregivers" section, add a link:
```tsx
{ icon: Users, label: 'Caregiver Portal', path: '/caregiver/login', color: 'from-pink-500 to-rose-600', bgColor: 'bg-pink-50', textColor: 'text-pink-600' }
```
Place it in `advancedFeatures` array. This lets a patient easily share the caregiver login link.

### MODIFY: `patient-portal/src/pages/FamilyAccessPage.tsx`
After the "Revoke" button for each grant, add a **"Share login link"** button:
- Copies `${window.location.origin}/${tenantSlug}/caregiver/login` to clipboard
- Also shows the `id` (UUID) of the grant as the "invitation code" in a tooltip or small text below: "Invitation code: {grant.id}"
- So the caregiver knows what to enter in the set-password form

## api.ts additions
```typescript
caregiverLogin: async (email: string, password: string, tenantSlug: string) => {
  const response = await fetch(`${API_BASE_URL}/patient-portal/caregiver/login`, {
    method: 'POST',
    headers: _withRid({ 'Content-Type': 'application/json', 'X-Tenant-ID': tenantSlug }),
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ message: 'Login failed' }));
    throw new Error(err.message || 'Caregiver login failed');
  }
  return response.json();
},

setCaregiverPassword: async (
  invitationToken: string,
  proxyEmail: string,
  newPassword: string,
  tenantSlug: string,
) => {
  const response = await fetch(`${API_BASE_URL}/patient-portal/caregiver/set-password`, {
    method: 'POST',
    headers: _withRid({ 'Content-Type': 'application/json', 'X-Tenant-ID': tenantSlug }),
    body: JSON.stringify({ invitationToken, proxyEmail, newPassword }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ message: 'Failed to set password' }));
    throw new Error(err.message || 'Failed to set password');
  }
  return response.json();
},

getCaregiverPatientSummary: async (token: string, tenantSlug: string) => {
  const response = await fetch(`${API_BASE_URL}/patient-portal/caregiver/patient-summary`, {
    headers: _withRid({ 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }),
  });
  _ensureOk(response, 'Failed to fetch caregiver patient summary');
  return response.json();
},
```

## Acceptance Criteria
- [ ] `ALTER TABLE patient_family_access ADD COLUMN IF NOT EXISTS password_hash` provisioned and applied via `repair-all`
- [ ] `POST /patient-portal/caregiver/set-password` sets bcrypt hash on the grant row
- [ ] `POST /patient-portal/caregiver/login` returns caregiver JWT with `type: 'caregiver'`
- [ ] `GET /patient-portal/caregiver/patient-summary` returns appointments, vitals, prescriptions
- [ ] `CaregiverLoginPage` renders at `/:tenantSlug/caregiver/login` with pink/rose palette
- [ ] `CaregiverSetPasswordPage` renders, sets password, redirects to login
- [ ] `CaregiverDashboard` renders read-only summary of patient data
- [ ] Caregiver logout redirects to `/:tenantSlug/caregiver/login`
- [ ] `FamilyAccessPage` shows invitation code and "Share login link" per grant
- [ ] Patient portal navigation is unaffected — existing patient auth unchanged
- [ ] No hardcoded `/demo-clinic/` slugs in new files
- [ ] Pink/rose color scheme clearly distinguishes caregiver portal from patient portal (indigo/blue)
