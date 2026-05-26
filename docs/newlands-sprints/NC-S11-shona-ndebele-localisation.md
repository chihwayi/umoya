# NC-S11 — Shona / Ndebele Full Localisation

**Sprint ID:** NC-S11  
**Priority:** High  
**Effort:** 6 days  
**Dependencies:** NC-S01 (tenant provisioning), NC-S10 (SMS/USSD templates)  
**Gaps Covered:**
- Feature 7.1 — Full UI localisation for Shona (sn) and Ndebele (nd) (0% → 100%)
- Feature 7.2 — Patient portal language preference persistence (0% → 100%)
- Feature 7.3 — Clinical form labels and validation messages in local languages (0% → 100%)
- Feature 7.4 — Language-aware PDF reports and letters (0% → 100%)

---

## 1. Codebase Context

### Existing Internationalisation Infrastructure
- **EHR Frontend:** No i18n library installed. All strings are hardcoded English in JSX.
- **Patient Portal:** No i18n. `react-i18next` is NOT in `package.json`.
- **Mobile App (Expo):** No i18n.
- **Patient entity:** `preferredLanguage VARCHAR(5)` column exists in `patients` table; default `'en'`.
- **No translation files exist** anywhere in the codebase.
- There is no language-selection UI component anywhere.

### What Must Be Localised (Priority Order)
1. Patient-facing Patient Portal (highest priority — patients read this)
2. Clinical form labels in EHR Frontend (provider fills these while patient watches)
3. PDF letter generation (discharge summaries, appointment letters sent home)
4. EHR admin UI (lower priority — trained staff, English acceptable short-term)

### Technology Choices
- **`react-i18next`** + **`i18next`** — industry standard, works in both React and React Native
- **`i18next-browser-languagedetector`** — auto-detects from `localStorage` / `navigator.language`
- **`i18next-http-backend`** — lazy-loads locale JSON files from `/locales/{lang}/translation.json`
- PDF: **`pdfmake`** already used for discharge summaries; translation strings injected before PDF generation

---

## 2. What This Sprint Builds

### Part A — i18n Library Setup (Both Frontend Apps)
Install and configure `react-i18next` in `ehr-frontend` and `patient-portal`.

### Part B — Translation Files
Complete translation dictionaries for English, Shona, and Ndebele covering all UI strings.

### Part C — Language Selector Component + Persistence
Dropdown/toggle that saves preference to backend and `localStorage`.

### Part D — Language-Aware PDF Generation
Pass the patient's `preferredLanguage` to the PDF generation pipeline and swap string sets.

---

## 3. Database Changes

### 3.1 No new tables required.
The `patients.preferredLanguage` column already exists.

### 3.2 Add `language` preference to staff sessions (system-level)
```typescript
// In tenant-service, ensureSubscriptionSchema():
await db.query(`ALTER TABLE staff ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(5) NOT NULL DEFAULT 'en'`);
```

### 3.3 After schema change: `POST /api/admin/tenants/repair-all`

---

## 4. Backend Implementation

### 4.1 Language Preference Endpoints
**File:** `services/ehr-service/src/controllers/preferences.controller.ts`

```typescript
import { Controller, Put, Body, Get, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { DatabaseService } from '../services/database.service';
import { Request } from 'express';

const ALLOWED_LANGUAGES = ['en', 'sn', 'nd'] as const;
type Language = typeof ALLOWED_LANGUAGES[number];

@Controller('preferences')
@UseGuards(JwtAuthGuard)
export class PreferencesController {
  constructor(private readonly db: DatabaseService) {}

  @Put('language')
  async setLanguage(
    @Body() body: { language: string; entityType: 'patient' | 'staff'; entityId: string },
    @Req() req: Request,
  ) {
    const { tenantDb } = req as any;
    const lang = body.language as Language;

    if (!ALLOWED_LANGUAGES.includes(lang)) {
      throw new Error(`Unsupported language: ${lang}. Allowed: ${ALLOWED_LANGUAGES.join(', ')}`);
    }

    const table = body.entityType === 'patient' ? 'patients' : 'staff';
    await this.db.query(
      tenantDb,
      `UPDATE ${table} SET preferred_language = $1 WHERE id = $2`,
      [lang, body.entityId],
    );

    return { language: lang, updated: true };
  }

  @Get('language/:entityType/:entityId')
  async getLanguage(
    @Req() req: Request,
  ) {
    const { tenantDb } = req as any;
    const { entityType, entityId } = (req as any).params;
    const table = entityType === 'patient' ? 'patients' : 'staff';

    const row = await this.db.queryOne<{ preferred_language: string }>(
      tenantDb,
      `SELECT preferred_language FROM ${table} WHERE id = $1`,
      [entityId],
    );
    return { language: row?.preferred_language ?? 'en' };
  }
}
```

### 4.2 Register controller in `ehr.module.ts`
```typescript
// Add to controllers array:
PreferencesController,
// Add to providers array:
// (PreferencesController uses DatabaseService which is already provided)
```

### 4.3 Language header middleware — pass `Accept-Language` through to PDF service
**File:** `services/ehr-service/src/middleware/language.middleware.ts`

```typescript
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LanguageMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    const lang = req.headers['x-language'] as string
      ?? req.query['lang'] as string
      ?? 'en';
    (req as any).lang = ['en', 'sn', 'nd'].includes(lang) ? lang : 'en';
    next();
  }
}
```

Register in `ehr.module.ts` configure:
```typescript
export class EhrModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LanguageMiddleware).forRoutes('*');
  }
}
```

---

## 5. Frontend Implementation — Patient Portal

### 5.1 Install i18n packages
```bash
# In patient-portal/
npm install react-i18next i18next i18next-browser-languagedetector i18next-http-backend
```

### 5.2 i18n Initialisation
**File:** `patient-portal/src/i18n.ts`

```typescript
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import HttpBackend from 'i18next-http-backend';

i18n
  .use(HttpBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    supportedLngs: ['en', 'sn', 'nd'],
    defaultNS: 'translation',
    backend: {
      loadPath: '/locales/{{lng}}/translation.json',
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
```

Import `'./i18n'` at the top of `patient-portal/src/main.tsx` (before any component renders).

### 5.3 Translation Files

**File:** `patient-portal/public/locales/en/translation.json`
```json
{
  "nav": {
    "dashboard": "Dashboard",
    "appointments": "Appointments",
    "results": "My Results",
    "medications": "Medications",
    "messages": "Messages",
    "profile": "My Profile",
    "logout": "Log Out"
  },
  "dashboard": {
    "welcome": "Welcome, {{name}}",
    "nextAppointment": "Next Appointment",
    "noAppointments": "No upcoming appointments",
    "recentResults": "Recent Results",
    "noResults": "No recent results",
    "medicationsDue": "Medications Due"
  },
  "appointments": {
    "upcoming": "Upcoming Appointments",
    "past": "Past Appointments",
    "confirm": "Confirm Attendance",
    "cancel": "Request Reschedule",
    "date": "Date",
    "time": "Time",
    "provider": "Provider",
    "status": "Status",
    "confirmed": "Confirmed",
    "pending": "Pending"
  },
  "results": {
    "testType": "Test",
    "value": "Result",
    "date": "Date",
    "noResults": "No results available",
    "vl": "Viral Load",
    "cd4": "CD4 Count",
    "hb": "Haemoglobin"
  },
  "medications": {
    "currentRegimen": "Current Regimen",
    "nextPickup": "Next Pickup Date",
    "requestRefill": "Request Refill",
    "refillRequested": "Refill Requested",
    "mmdInfo": "You are on multi-month dispensing"
  },
  "profile": {
    "firstName": "First Name",
    "lastName": "Last Name",
    "dateOfBirth": "Date of Birth",
    "phone": "Phone Number",
    "language": "Preferred Language",
    "save": "Save Changes",
    "saved": "Changes saved"
  },
  "common": {
    "loading": "Loading...",
    "error": "Something went wrong. Please try again.",
    "back": "Back",
    "cancel": "Cancel",
    "confirm": "Confirm",
    "yes": "Yes",
    "no": "No"
  },
  "auth": {
    "login": "Log In",
    "logout": "Log Out",
    "username": "Username",
    "password": "Password",
    "forgotPassword": "Forgot password?",
    "loginError": "Invalid username or password"
  }
}
```

**File:** `patient-portal/public/locales/sn/translation.json`
```json
{
  "nav": {
    "dashboard": "Dhashbhodhi",
    "appointments": "Misangano",
    "results": "Mhedzisiro Yangu",
    "medications": "Mishonga",
    "messages": "Meseji",
    "profile": "Pfupiso Yangu",
    "logout": "Buda"
  },
  "dashboard": {
    "welcome": "Mauya, {{name}}",
    "nextAppointment": "Musangano Unotevera",
    "noAppointments": "Hapana misangano inouya",
    "recentResults": "Mhedzisiro Yezvino",
    "noResults": "Hapana mhedzisiro yezvino",
    "medicationsDue": "Mishonga Yakokwa"
  },
  "appointments": {
    "upcoming": "Misangano Inouya",
    "past": "Misangano Yapfuura",
    "confirm": "Simbisa Kuuya",
    "cancel": "Kumbira Kushandura Zuva",
    "date": "Zuva",
    "time": "Nguva",
    "provider": "Chiremba",
    "status": "Mamiriro",
    "confirmed": "Yakasimbiswa",
    "pending": "Inomirirwa"
  },
  "results": {
    "testType": "Bvunzo",
    "value": "Mhedzisiro",
    "date": "Zuva",
    "noResults": "Hapana mhedzisiro",
    "vl": "Viral Load",
    "cd4": "CD4",
    "hb": "Hemoglobini"
  },
  "medications": {
    "currentRegimen": "Regimen Yanhasi",
    "nextPickup": "Zuva Rokutora Mushonga",
    "requestRefill": "Kumbira Mishonga",
    "refillRequested": "Kukumbira Kwatumirwa",
    "mmdInfo": "Uri pa multi-month dispensing"
  },
  "profile": {
    "firstName": "Zita Rokutanga",
    "lastName": "Zita Romhuri",
    "dateOfBirth": "Zuva Rokuzvarwa",
    "phone": "Nhamba Yefoni",
    "language": "Mutauro Unodiwa",
    "save": "Chengetedza Shanduko",
    "saved": "Shanduko Dzachengetedzwa"
  },
  "common": {
    "loading": "Kumirira...",
    "error": "Pane chakaipa. Ndokumbirawo uedze zvakare.",
    "back": "Dzoka",
    "cancel": "Kanzura",
    "confirm": "Simbisa",
    "yes": "Hongu",
    "no": "Kwete"
  },
  "auth": {
    "login": "Pinda",
    "logout": "Buda",
    "username": "Zita Remushandisi",
    "password": "Pasiwaadhi",
    "forgotPassword": "Wakanganwa pasiwaadhi?",
    "loginError": "Zita kana pasiwaadhi hazvibvumirwe"
  }
}
```

**File:** `patient-portal/public/locales/nd/translation.json`
```json
{
  "nav": {
    "dashboard": "Ikhasi Elikhulu",
    "appointments": "Izikhathi Zokubonana",
    "results": "Imiphumela Yami",
    "medications": "Imithi",
    "messages": "Imiyalezo",
    "profile": "Imininingwane Yami",
    "logout": "Phuma"
  },
  "dashboard": {
    "welcome": "Wamukelekile, {{name}}",
    "nextAppointment": "Isikhathi Esilandelayo",
    "noAppointments": "Akulazikhathi ezizayo",
    "recentResults": "Imiphumela Yakamuva",
    "noResults": "Akulamiphumela yakamuva",
    "medicationsDue": "Imithi Efanele Ukuthathwa"
  },
  "appointments": {
    "upcoming": "Izikhathi Ezizayo",
    "past": "Izikhathi Eziyadlulayo",
    "confirm": "Qinisekisa Ukuza",
    "cancel": "Cela Ukushintsha Usuku",
    "date": "Usuku",
    "time": "Isikhathi",
    "provider": "Udokotela",
    "status": "Isimo",
    "confirmed": "Kuqinisekisiwe",
    "pending": "Kulindile"
  },
  "results": {
    "testType": "Uhlolo",
    "value": "Umphumela",
    "date": "Usuku",
    "noResults": "Akulamiphumela",
    "vl": "Viral Load",
    "cd4": "CD4",
    "hb": "Haemoglobin"
  },
  "medications": {
    "currentRegimen": "Umthetho Wamanje Wemithi",
    "nextPickup": "Usuku Lokuthatha Imithi",
    "requestRefill": "Cela Ukugcwaliswa Kwemithi",
    "refillRequested": "Isicelo Sithunyiwe",
    "mmdInfo": "Usemaphaketheni amaningi wemithi"
  },
  "profile": {
    "firstName": "Ibizo Lokuqala",
    "lastName": "Isibongo",
    "dateOfBirth": "Usuku Lokuzalwa",
    "phone": "Inombolo Yethelevishini",
    "language": "Ulimi Olukhethwayo",
    "save": "Gcina Izinguquko",
    "saved": "Izinguquko Zigcinwe"
  },
  "common": {
    "loading": "Kulindile...",
    "error": "Kukhona okungahambanga kahle. Zama futhi.",
    "back": "Buyela",
    "cancel": "Khansela",
    "confirm": "Qinisekisa",
    "yes": "Yebo",
    "no": "Cha"
  },
  "auth": {
    "login": "Ngena",
    "logout": "Phuma",
    "username": "Igama Lomsebenzisi",
    "password": "Iphasiwedi",
    "forgotPassword": "Ukhohlwe iphasiwedi?",
    "loginError": "Igama noma iphasiwedi ayilungile"
  }
}
```

### 5.4 Language Selector Component
**File:** `patient-portal/src/components/LanguageSelector.tsx`

```typescript
import React from 'react';
import { useTranslation } from 'react-i18next';

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'sn', label: 'ChiShona' },
  { code: 'nd', label: 'IsiNdebele' },
];

interface Props {
  patientId?: string;
  onChanged?: (lang: string) => void;
}

export const LanguageSelector: React.FC<Props> = ({ patientId, onChanged }) => {
  const { i18n } = useTranslation();

  const handleChange = async (lang: string) => {
    await i18n.changeLanguage(lang);
    localStorage.setItem('i18nextLng', lang);

    if (patientId) {
      await fetch('/api/preferences/language', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ language: lang, entityType: 'patient', entityId: patientId }),
      });
    }

    onChanged?.(lang);
  };

  return (
    <select
      value={i18n.language}
      onChange={(e) => handleChange(e.target.value)}
      aria-label="Select language"
      style={{ padding: '4px 8px', borderRadius: 4 }}
    >
      {LANGUAGES.map((l) => (
        <option key={l.code} value={l.code}>{l.label}</option>
      ))}
    </select>
  );
};
```

### 5.5 Update existing Patient Portal components to use `useTranslation`

**Pattern — apply to every existing component that has hardcoded English:**

```typescript
// Before:
<h1>Welcome, {patient.name}</h1>
<p>No upcoming appointments</p>

// After:
import { useTranslation } from 'react-i18next';
const { t } = useTranslation();
<h1>{t('dashboard.welcome', { name: patient.name })}</h1>
<p>{t('dashboard.noAppointments')}</p>
```

**Files to update (each contains hardcoded English strings):**
- `patient-portal/src/pages/DashboardPage.tsx`
- `patient-portal/src/pages/AppointmentsPage.tsx`
- `patient-portal/src/pages/LabResultsPage.tsx`
- `patient-portal/src/pages/MedicationsPage.tsx`
- `patient-portal/src/pages/ProfilePage.tsx`
- `patient-portal/src/components/Navbar.tsx`
- `patient-portal/src/pages/LoginPage.tsx`

**Rule for each file:** Import `useTranslation`, call `const { t } = useTranslation()`, replace every hardcoded string with `t('key')`. Never use string concatenation — always use interpolation: `t('dashboard.welcome', { name })`.

---

## 6. Frontend Implementation — EHR Frontend

### 6.1 Install i18n packages
```bash
# In ehr-frontend/
npm install react-i18next i18next i18next-browser-languagedetector i18next-http-backend
```

### 6.2 EHR i18n config
**File:** `ehr-frontend/src/i18n.ts`
```typescript
// Same structure as patient-portal/src/i18n.ts above — copy verbatim, change loadPath to '/ehr/locales/{{lng}}/translation.json'
```

### 6.3 EHR Translation Files (clinical form labels)
**File:** `ehr-frontend/public/locales/en/translation.json`

```json
{
  "clinical": {
    "vitalSigns": "Vital Signs",
    "bloodPressure": "Blood Pressure",
    "weight": "Weight (kg)",
    "height": "Height (cm)",
    "temperature": "Temperature (°C)",
    "pulseRate": "Pulse Rate",
    "oxygenSaturation": "Oxygen Saturation",
    "cd4Count": "CD4 Count (cells/μL)",
    "viralLoad": "Viral Load (copies/mL)",
    "haemoglobin": "Haemoglobin (g/dL)",
    "creatinine": "Creatinine (μmol/L)",
    "nextVisit": "Next Visit Date",
    "clinicalNotes": "Clinical Notes"
  },
  "hiv": {
    "enrollmentDate": "Enrollment Date",
    "currentRegimen": "Current Regimen",
    "regimenStartDate": "Regimen Start Date",
    "adherence": "Adherence",
    "whoStage": "WHO Stage",
    "tbStatus": "TB Status",
    "pregnancyStatus": "Pregnancy Status"
  },
  "labels": {
    "patientId": "Patient ID",
    "firstName": "First Name",
    "lastName": "Last Name",
    "dateOfBirth": "Date of Birth",
    "sex": "Sex",
    "male": "Male",
    "female": "Female",
    "village": "Village / Address",
    "phone": "Phone Number"
  }
}
```

**File:** `ehr-frontend/public/locales/sn/translation.json`
```json
{
  "clinical": {
    "vitalSigns": "Zvokupimwa",
    "bloodPressure": "Kuyevedza Ropa",
    "weight": "Uremu (kg)",
    "height": "Kureba (cm)",
    "temperature": "Tembiricha (°C)",
    "pulseRate": "Moto Weropa",
    "oxygenSaturation": "Oxygen",
    "cd4Count": "CD4 (masero/μL)",
    "viralLoad": "Viral Load",
    "haemoglobin": "Hemoglobini (g/dL)",
    "creatinine": "Creatinine",
    "nextVisit": "Zuva Rokunobata Chiremba",
    "clinicalNotes": "Manotisi eMuchato"
  },
  "hiv": {
    "enrollmentDate": "Zuva Rokuvhara",
    "currentRegimen": "Regimen Yanhasi",
    "regimenStartDate": "Regimen Yakatangira",
    "adherence": "Kuteerera Mishonga",
    "whoStage": "Mutumbi weHurumende",
    "tbStatus": "Mamiriro eTB",
    "pregnancyStatus": "Mamiriro eNhumbu"
  },
  "labels": {
    "patientId": "ID Yomurwere",
    "firstName": "Zita Rokutanga",
    "lastName": "Zita Romhuri",
    "dateOfBirth": "Zuva Rokuzvarwa",
    "sex": "Murume/Mukadzi",
    "male": "Murume",
    "female": "Mukadzi",
    "village": "Musha / Kero",
    "phone": "Nhamba Yefoni"
  }
}
```

**File:** `ehr-frontend/public/locales/nd/translation.json`
```json
{
  "clinical": {
    "vitalSigns": "Izilinganiso Zempilo",
    "bloodPressure": "Ingcindezelo Yegazi",
    "weight": "Isisindo (kg)",
    "height": "Ubude (cm)",
    "temperature": "Ukushisa (°C)",
    "pulseRate": "Ukushaya Kwenhliziyo",
    "oxygenSaturation": "Oksijeni",
    "cd4Count": "CD4 (amaseli/μL)",
    "viralLoad": "Viral Load",
    "haemoglobin": "Haemoglobin (g/dL)",
    "creatinine": "Creatinine",
    "nextVisit": "Usuku Lokubuya",
    "clinicalNotes": "Amanothi Odokotela"
  },
  "hiv": {
    "enrollmentDate": "Usuku Lokubhalisa",
    "currentRegimen": "Umthetho Wamanje Wemithi",
    "regimenStartDate": "Umthetho Owaqalwa",
    "adherence": "Ukuthekelela Imiyalelo",
    "whoStage": "Isigaba seWHO",
    "tbStatus": "Isimo seTB",
    "pregnancyStatus": "Isimo Sokukhulelwa"
  },
  "labels": {
    "patientId": "ID Yesiguli",
    "firstName": "Ibizo Lokuqala",
    "lastName": "Isibongo",
    "dateOfBirth": "Usuku Lokuzalwa",
    "sex": "Ubulili",
    "male": "Owesilisa",
    "female": "Owesifazane",
    "village": "Umzana / Ikheli",
    "phone": "Inombolo Yethelevishini"
  }
}
```

---

## 7. PDF Localisation

### 7.1 Translation strings for PDF
**File:** `services/ehr-service/src/services/pdf-translations.ts`

```typescript
export type PdfLang = 'en' | 'sn' | 'nd';

export const PDF_STRINGS: Record<PdfLang, Record<string, string>> = {
  en: {
    appointmentLetter: 'APPOINTMENT LETTER',
    dear: 'Dear',
    appointmentOn: 'You have an appointment on',
    at: 'at',
    with: 'with',
    pleaseAttend: 'Please ensure you attend on time. Bring this letter and your health booklet.',
    clinicName: 'Newlands Clinic',
    dischargeSummary: 'DISCHARGE SUMMARY',
    admittedOn: 'Admitted on',
    dischargedOn: 'Discharged on',
    diagnosis: 'Diagnosis',
    treatment: 'Treatment Given',
    followUp: 'Follow-up Instructions',
    signature: 'Authorised by',
  },
  sn: {
    appointmentLetter: 'TSAMBA YEMUSANGANO',
    dear: 'Kwamuri',
    appointmentOn: 'Mune musangano musi wa',
    at: 'nguva ya',
    with: 'nachiremba',
    pleaseAttend: 'Ndokumbirawo musvike nguva. Uyise tsamba iyi nhengo yako yeutano.',
    clinicName: 'Kiriniki yeNewlands',
    dischargeSummary: 'MUTSARA WEKUBUDITSA',
    admittedOn: 'Wakapinda musi wa',
    dischargedOn: 'Wakabuditsa musi wa',
    diagnosis: 'Chirwere',
    treatment: 'Mishonga Yakaiswa',
    followUp: 'Zvinotevera',
    signature: 'Yakagurukirwa na',
  },
  nd: {
    appointmentLetter: 'INCWADI YESIKHATHI',
    dear: 'Ngiyakubingelela',
    appointmentOn: 'Unesikhathi sokubonana ngomhla ka',
    at: 'ngehora',
    with: 'lodokotela',
    pleaseAttend: 'Sicela uze ngesikhathi. Letha le ncwadi kanye nebhuku lakho lempilo.',
    clinicName: 'I-Newlands Clinic',
    dischargeSummary: 'ISIFINYEZO SOKUKHISHWA',
    admittedOn: 'Wangena ngomhla ka',
    dischargedOn: 'Wakhishwa ngomhla ka',
    diagnosis: 'Isifo',
    treatment: 'Imithi Enikezwe',
    followUp: 'Iziqondiso Zokubuya',
    signature: 'Agunyaziwe ngu',
  },
};

export function getPdfString(lang: PdfLang, key: string): string {
  return PDF_STRINGS[lang]?.[key] ?? PDF_STRINGS['en'][key] ?? key;
}
```

### 7.2 Update PDF generation to pass language
**File:** `services/ehr-service/src/services/pdf.service.ts` — find `generateAppointmentLetter()` and update:

```typescript
import { getPdfString, PdfLang } from './pdf-translations';

// Add lang parameter:
async generateAppointmentLetter(appointment: AppointmentData, lang: PdfLang = 'en'): Promise<Buffer> {
  const t = (key: string) => getPdfString(lang, key);

  const docDef = {
    content: [
      { text: t('clinicName'), style: 'header' },
      { text: t('appointmentLetter'), style: 'subheader' },
      { text: `${t('dear')} ${appointment.patientName},`, margin: [0, 20, 0, 0] },
      {
        text: `${t('appointmentOn')} ${appointment.date} ${t('at')} ${appointment.time} ${t('with')} ${appointment.provider}.`,
        margin: [0, 10, 0, 10],
      },
      { text: t('pleaseAttend') },
    ],
    // ... rest of docDef unchanged
  };
  // ... rest unchanged
}
```

---

## 8. Mobile App (Expo) Localisation

### 8.1 Install packages
```bash
# In mobile/
npm install react-i18next i18next
```

### 8.2 Translations embedded in bundle (no HTTP backend for offline support)
**File:** `mobile/src/i18n.ts`

```typescript
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import sn from './locales/sn.json';
import nd from './locales/nd.json';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    sn: { translation: sn },
    nd: { translation: nd },
  },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;
```

**Files:** `mobile/src/locales/en.json`, `mobile/src/locales/sn.json`, `mobile/src/locales/nd.json`
— same key structure as patient-portal translation files above; copy and adapt for mobile context.

---

## 9. Tests Required

**File:** `patient-portal/src/components/__tests__/LanguageSelector.test.tsx`

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { LanguageSelector } from '../LanguageSelector';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../i18n';

describe('LanguageSelector', () => {
  it('renders English, Shona, Ndebele options', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <LanguageSelector />
      </I18nextProvider>
    );
    expect(screen.getByText('English')).toBeInTheDocument();
    expect(screen.getByText('ChiShona')).toBeInTheDocument();
    expect(screen.getByText('IsiNdebele')).toBeInTheDocument();
  });

  it('changes i18n language on selection', async () => {
    render(
      <I18nextProvider i18n={i18n}>
        <LanguageSelector />
      </I18nextProvider>
    );
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'sn' } });
    expect(i18n.language).toBe('sn');
  });
});
```

**File:** `services/ehr-service/src/controllers/__tests__/preferences.controller.spec.ts`

```typescript
describe('PreferencesController', () => {
  it('rejects unsupported language codes', async () => {
    const controller = new PreferencesController(mockDb);
    await expect(controller.setLanguage({ language: 'fr', entityType: 'patient', entityId: 'p1' }, mockReq)).rejects.toThrow('Unsupported language');
  });

  it('updates patient preferred_language', async () => {
    mockDb.query.mockResolvedValue([]);
    const controller = new PreferencesController(mockDb);
    const result = await controller.setLanguage({ language: 'sn', entityType: 'patient', entityId: 'p1' }, mockReq);
    expect(result.language).toBe('sn');
    expect(result.updated).toBe(true);
  });
});
```

**Manual verification:**
- Switch portal language to ChiShona → all nav, dashboard, appointments page text shows Shona strings
- Switch to IsiNdebele → all text shows Ndebele strings
- Switch back to English → English strings restored
- Language survives page refresh (localStorage persisted)
- PDF appointment letter generated with `lang=sn` contains Shona text

---

## 10. Sign-off Criteria

- [ ] `npm run lint` passes zero errors in `ehr-frontend`, `patient-portal`, `mobile`, `services/ehr-service`
- [ ] `npm test` passes all tests including i18n and preferences controller specs
- [ ] CI `build-and-test` job passes green
- [ ] `POST /api/admin/tenants/repair-all` backfills `staff.preferred_language` column
- [ ] Patient Portal renders fully in ChiShona with no untranslated `[key]` placeholders visible
- [ ] Patient Portal renders fully in IsiNdebele with no untranslated `[key]` placeholders visible
- [ ] Language preference persisted to `patients.preferred_language` via `PUT /preferences/language`
- [ ] PDF appointment letter generated with patient's preferred language
- [ ] `LanguageSelector` component tests pass in patient-portal
- [ ] Mobile app language switch works (i18n bundle loaded offline)
