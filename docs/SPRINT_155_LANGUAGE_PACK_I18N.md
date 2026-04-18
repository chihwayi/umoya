# Sprint 155 — Language Pack: Portuguese, French, Swahili, Zulu, Afrikaans (i18n Framework + NLP)

**Sprint**: S155  
**Module**: Frontend Internationalisation Framework, 5 African Language Packs, Clinical NLP Locale Awareness  
**Bundle version**: `2026.04.17.1`  
**Bundle ID**: `sprint155_language_pack_i18n`  
**Prerequisite reading**: `MEDICORE_REFERENCE.md` — architecture, DB rules, CDSS call patterns.

---

## 1. Clinical Rationale

MediCore's current language support is English, Shona, and Ndebele only. This excludes the majority of the African continent:

| Language | Speakers | Countries | Clinical Impact |
|---|---|---|---|
| Portuguese | 280M | Mozambique, Angola, Guinea-Bissau, Cape Verde, São Tomé | DISA/Mozambique integration unusable without Portuguese UI |
| French | 300M in Africa | DRC, Congo, Cameroon, Senegal, Côte d'Ivoire, 22 countries | SORMAS deployments in Francophone Africa require French |
| Swahili (Kiswahili) | 200M | Tanzania, Kenya, Uganda, DRC, Rwanda, Burundi | CHW/mobile apps; key East Africa deployment language |
| Zulu (isiZulu) | 12M native + 28M 2nd | South Africa (KwaZulu-Natal) | SA health system requirement |
| Afrikaans | 7M native | South Africa, Namibia | SA government health facility requirement |

### What already exists (do NOT recreate)

- Shona (`sn`) and Ndebele (`nd`) translation files already in place — check location before writing
- Frontend stack: React + Tailwind v3 + `lucide-react`
- `ehr-frontend/src/services/api.ts` — all API calls go here

### What to implement

1. **i18n framework** — install `react-i18next` + `i18next`, configure with `LanguageDetector`
2. **Translation files** for `pt`, `fr`, `sw`, `zu`, `af` — 100+ clinical key strings each
3. **Language switcher** UI component — persists in `localStorage`
4. **CDSS locale parameter** — pass `locale` to CDSS prompts so AI responds in the user's language
5. **DB table** for user language preferences (per user, per tenant)

---

## 2. Database Changes

### 2a. Provisioning Statements

**File: `services/tenant-service/src/generated/tenant-language-preferences.statements.ts`**

```typescript
export const TENANT_LANGUAGE_PREFS_BUNDLE_VERSION = '2026.04.17.1';

export const TENANT_LANGUAGE_PREFS_STATEMENTS: string[] = [

  `CREATE TABLE IF NOT EXISTS user_language_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,
    preferred_language TEXT NOT NULL DEFAULT 'en',  -- ISO 639-1: 'en' | 'pt' | 'fr' | 'sw' | 'zu' | 'af' | 'sn' | 'nd'
    secondary_language TEXT,                         -- fallback if key missing in primary
    clinical_note_language TEXT NOT NULL DEFAULT 'en',  -- language for AI-generated clinical notes
    ui_language TEXT NOT NULL DEFAULT 'en',
    last_updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,

  `CREATE INDEX IF NOT EXISTS idx_user_lang_prefs_user ON user_language_preferences(user_id)`,

  // Seed default language config
  `INSERT INTO user_language_preferences (id, user_id, preferred_language, ui_language)
   VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'en', 'en')
   ON CONFLICT (user_id) DO NOTHING`,

];
```

### 2b. Register Bundle

```typescript
import {
  TENANT_LANGUAGE_PREFS_BUNDLE_VERSION,
  TENANT_LANGUAGE_PREFS_STATEMENTS,
} from './generated/tenant-language-preferences.statements';

{
  id: 'sprint155_language_pack_i18n',
  label: 'Sprint 155 — Language Pack i18n (user_language_preferences)',
  version: TENANT_LANGUAGE_PREFS_BUNDLE_VERSION,
  description: 'Creates user_language_preferences table; seeds default English row',
  statements: TENANT_LANGUAGE_PREFS_STATEMENTS,
},
```

---

## 3. TypeORM Entity

**File: `services/ehr-service/src/settings/entities/user-language-preference.entity.ts`**

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity({ name: 'user_language_preferences' })
export class UserLanguagePreference {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'user_id', unique: true }) userId: string;
  @Column({ name: 'preferred_language', default: 'en' }) preferredLanguage: string;
  @Column({ name: 'secondary_language', nullable: true }) secondaryLanguage: string;
  @Column({ name: 'clinical_note_language', default: 'en' }) clinicalNoteLanguage: string;
  @Column({ name: 'ui_language', default: 'en' }) uiLanguage: string;
  @Column({ name: 'last_updated_at', type: 'timestamp' }) lastUpdatedAt: Date;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
```

Register in `tenant.service.ts`:
```typescript
import { UserLanguagePreference } from '../ehr/settings/entities/user-language-preference.entity';
// Add: UserLanguagePreference
```

---

## 4. EHR Backend — Language Preferences Endpoint

**File: `services/ehr-service/src/settings/language.service.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserLanguagePreference } from './entities/user-language-preference.entity';

const SUPPORTED_LANGUAGES = ['en', 'pt', 'fr', 'sw', 'zu', 'af', 'sn', 'nd'];

@Injectable()
export class LanguageService {
  constructor(
    @InjectRepository(UserLanguagePreference)
    private langRepo: Repository<UserLanguagePreference>,
  ) {}

  async getUserLanguage(userId: string): Promise<UserLanguagePreference> {
    let pref = await this.langRepo.findOne({ where: { userId } });
    if (!pref) {
      pref = await this.langRepo.save(this.langRepo.create({ userId, preferredLanguage: 'en', uiLanguage: 'en', clinicalNoteLanguage: 'en', lastUpdatedAt: new Date() }));
    }
    return pref;
  }

  async setUserLanguage(userId: string, uiLanguage: string, clinicalNoteLanguage?: string): Promise<UserLanguagePreference> {
    if (!SUPPORTED_LANGUAGES.includes(uiLanguage)) throw new Error(`Unsupported language: ${uiLanguage}`);
    const existing = await this.langRepo.findOne({ where: { userId } });
    if (existing) {
      await this.langRepo.update(existing.id, { uiLanguage, preferredLanguage: uiLanguage, clinicalNoteLanguage: clinicalNoteLanguage ?? uiLanguage, lastUpdatedAt: new Date() });
      return this.langRepo.findOneOrFail({ where: { userId } });
    }
    return this.langRepo.save(this.langRepo.create({ userId, preferredLanguage: uiLanguage, uiLanguage, clinicalNoteLanguage: clinicalNoteLanguage ?? uiLanguage, lastUpdatedAt: new Date() }));
  }

  getSupportedLanguages(): object[] {
    return [
      { code: 'en', name: 'English', nativeName: 'English' },
      { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
      { code: 'fr', name: 'French', nativeName: 'Français' },
      { code: 'sw', name: 'Swahili', nativeName: 'Kiswahili' },
      { code: 'zu', name: 'Zulu', nativeName: 'isiZulu' },
      { code: 'af', name: 'Afrikaans', nativeName: 'Afrikaans' },
      { code: 'sn', name: 'Shona', nativeName: 'chiShona' },
      { code: 'nd', name: 'Ndebele', nativeName: 'isiNdebele' },
    ];
  }
}
```

**Controller** (`GET /settings/language`, `PUT /settings/language`, `GET /settings/languages`) — standard pattern with `JwtAuthGuard`.

Register `LanguageModule` in `ehr.module.ts`.

---

## 5. CDSS — Locale-Aware Prompts

In `services/cdss-service/main.py`, add locale parameter to all existing request models:

```python
# Add to the base models used by CDSS endpoints:
class LocaleAwareMixin(BaseModel):
    locale: str = "en"  # ISO 639-1 language code

# In every CDSS prompt, append:
# f"\n\nIMPORTANT: Respond in {locale_name} language (ISO code: {req.locale}). Clinical terms may remain in English/Latin where standard medical practice dictates, but all explanations, recommendations, and patient-facing text must be in {locale_name}."

LOCALE_NAMES = {
    "en": "English", "pt": "Portuguese", "fr": "French",
    "sw": "Swahili", "zu": "Zulu", "af": "Afrikaans",
    "sn": "Shona", "nd": "Ndebele"
}
```

For the top-5 most-used CDSS endpoints, add `locale: str = "en"` to request model and append the locale instruction to the prompt. Endpoints to update:
1. `POST /cdss/chat` (general chat)
2. `POST /cdss/differential-diagnosis`
3. `POST /cdss/drug-interactions`
4. `POST /cdss/vhf/risk-triage` (from S150)
5. `POST /cdss/maternal/death-audit-review` (from S147)

---

## 6. Frontend i18n Framework

### 6a. Install dependencies

```bash
cd ehr-frontend
npm install i18next react-i18next i18next-browser-languagedetector i18next-http-backend
```

### 6b. i18n config

**File: `ehr-frontend/src/i18n/index.ts`**

```typescript
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import pt from './locales/pt.json';
import fr from './locales/fr.json';
import sw from './locales/sw.json';
import zu from './locales/zu.json';
import af from './locales/af.json';
import sn from './locales/sn.json';
import nd from './locales/nd.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { en: { translation: en }, pt: { translation: pt }, fr: { translation: fr }, sw: { translation: sw }, zu: { translation: zu }, af: { translation: af }, sn: { translation: sn }, nd: { translation: nd } },
    fallbackLng: 'en',
    detection: { order: ['localStorage', 'navigator'], caches: ['localStorage'] },
    interpolation: { escapeValue: false },
  });

export default i18n;
```

Import in `main.tsx`: `import './i18n';` (before App render).

### 6c. Translation files

**File: `ehr-frontend/src/i18n/locales/en.json`** — source of truth (100+ clinical keys):

```json
{
  "nav": {
    "dashboard": "Dashboard", "patients": "Patients", "appointments": "Appointments",
    "lab": "Laboratory", "pharmacy": "Pharmacy", "billing": "Billing",
    "reports": "Reports", "settings": "Settings"
  },
  "patient": {
    "register": "Register Patient", "search": "Search Patient",
    "name": "Full Name", "dob": "Date of Birth", "sex": "Sex",
    "phone": "Phone Number", "address": "Address", "id_number": "ID Number",
    "hiv_status": "HIV Status", "blood_group": "Blood Group"
  },
  "clinical": {
    "vitals": "Vital Signs", "weight": "Weight (kg)", "height": "Height (cm)",
    "bp": "Blood Pressure", "temp": "Temperature (°C)", "pulse": "Pulse (bpm)",
    "spo2": "SpO₂ (%)", "diagnosis": "Diagnosis", "prescription": "Prescription",
    "allergies": "Allergies", "chief_complaint": "Chief Complaint",
    "history": "History of Presenting Illness", "examination": "Examination",
    "plan": "Management Plan", "referral": "Referral", "follow_up": "Follow-up"
  },
  "billing": {
    "invoice": "Invoice", "payment": "Payment", "insurance": "Insurance",
    "cbhi": "CBHI", "nhif": "NHIF", "receipt": "Receipt"
  },
  "ai": {
    "cdss_recommendation": "AI Recommendation", "confidence": "Confidence",
    "abstained": "AI abstained — clinical judgement required",
    "view_citations": "View Citations", "disclaimer": "AI-assisted — verify clinically"
  },
  "common": {
    "save": "Save", "cancel": "Cancel", "edit": "Edit", "delete": "Delete",
    "search": "Search", "filter": "Filter", "export": "Export", "print": "Print",
    "loading": "Loading...", "error": "An error occurred", "success": "Saved successfully",
    "yes": "Yes", "no": "No", "required": "Required", "optional": "Optional",
    "date": "Date", "time": "Time", "notes": "Notes", "status": "Status"
  }
}
```

**File: `ehr-frontend/src/i18n/locales/pt.json`** — Portuguese translations of ALL keys above:

```json
{
  "nav": {
    "dashboard": "Painel", "patients": "Pacientes", "appointments": "Consultas",
    "lab": "Laboratório", "pharmacy": "Farmácia", "billing": "Faturação",
    "reports": "Relatórios", "settings": "Configurações"
  },
  "patient": {
    "register": "Registar Paciente", "search": "Pesquisar Paciente",
    "name": "Nome Completo", "dob": "Data de Nascimento", "sex": "Sexo",
    "phone": "Número de Telefone", "address": "Endereço", "id_number": "Número de BI",
    "hiv_status": "Estado HIV", "blood_group": "Grupo Sanguíneo"
  },
  "clinical": {
    "vitals": "Sinais Vitais", "weight": "Peso (kg)", "height": "Altura (cm)",
    "bp": "Pressão Arterial", "temp": "Temperatura (°C)", "pulse": "Pulso (bpm)",
    "spo2": "SpO₂ (%)", "diagnosis": "Diagnóstico", "prescription": "Prescrição",
    "allergies": "Alergias", "chief_complaint": "Queixa Principal",
    "history": "História da Doença Actual", "examination": "Exame Físico",
    "plan": "Plano de Tratamento", "referral": "Referência", "follow_up": "Consulta de Seguimento"
  },
  "billing": {
    "invoice": "Factura", "payment": "Pagamento", "insurance": "Seguro",
    "cbhi": "Seguro Comunitário", "nhif": "NHIF", "receipt": "Recibo"
  },
  "ai": {
    "cdss_recommendation": "Recomendação da IA", "confidence": "Confiança",
    "abstained": "IA absteve-se — julgamento clínico necessário",
    "view_citations": "Ver Citações", "disclaimer": "Assistido por IA — verificar clinicamente"
  },
  "common": {
    "save": "Guardar", "cancel": "Cancelar", "edit": "Editar", "delete": "Eliminar",
    "search": "Pesquisar", "filter": "Filtrar", "export": "Exportar", "print": "Imprimir",
    "loading": "A carregar...", "error": "Ocorreu um erro", "success": "Guardado com sucesso",
    "yes": "Sim", "no": "Não", "required": "Obrigatório", "optional": "Opcional",
    "date": "Data", "time": "Hora", "notes": "Notas", "status": "Estado"
  }
}
```

**File: `ehr-frontend/src/i18n/locales/fr.json`** — French:

```json
{
  "nav": {
    "dashboard": "Tableau de bord", "patients": "Patients", "appointments": "Rendez-vous",
    "lab": "Laboratoire", "pharmacy": "Pharmacie", "billing": "Facturation",
    "reports": "Rapports", "settings": "Paramètres"
  },
  "patient": {
    "register": "Enregistrer un Patient", "search": "Rechercher un Patient",
    "name": "Nom Complet", "dob": "Date de Naissance", "sex": "Sexe",
    "phone": "Numéro de Téléphone", "address": "Adresse", "id_number": "Numéro de Pièce d'Identité",
    "hiv_status": "Statut VIH", "blood_group": "Groupe Sanguin"
  },
  "clinical": {
    "vitals": "Signes Vitaux", "weight": "Poids (kg)", "height": "Taille (cm)",
    "bp": "Tension Artérielle", "temp": "Température (°C)", "pulse": "Pouls (bpm)",
    "spo2": "SpO₂ (%)", "diagnosis": "Diagnostic", "prescription": "Prescription",
    "allergies": "Allergies", "chief_complaint": "Motif de Consultation",
    "history": "Histoire de la Maladie", "examination": "Examen Physique",
    "plan": "Plan de Prise en Charge", "referral": "Référence", "follow_up": "Consultation de Suivi"
  },
  "billing": {
    "invoice": "Facture", "payment": "Paiement", "insurance": "Assurance",
    "cbhi": "Mutuelle de Santé", "nhif": "NHIF", "receipt": "Reçu"
  },
  "ai": {
    "cdss_recommendation": "Recommandation IA", "confidence": "Confiance",
    "abstained": "IA abstention — jugement clinique requis",
    "view_citations": "Voir les Citations", "disclaimer": "Assisté par IA — vérifier cliniquement"
  },
  "common": {
    "save": "Enregistrer", "cancel": "Annuler", "edit": "Modifier", "delete": "Supprimer",
    "search": "Rechercher", "filter": "Filtrer", "export": "Exporter", "print": "Imprimer",
    "loading": "Chargement...", "error": "Une erreur s'est produite", "success": "Enregistré avec succès",
    "yes": "Oui", "no": "Non", "required": "Obligatoire", "optional": "Facultatif",
    "date": "Date", "time": "Heure", "notes": "Notes", "status": "Statut"
  }
}
```

**File: `ehr-frontend/src/i18n/locales/sw.json`** — Swahili:

```json
{
  "nav": {
    "dashboard": "Dashibodi", "patients": "Wagonjwa", "appointments": "Miadi",
    "lab": "Maabara", "pharmacy": "Duka la Dawa", "billing": "Malipo",
    "reports": "Ripoti", "settings": "Mipangilio"
  },
  "patient": {
    "register": "Sajili Mgonjwa", "search": "Tafuta Mgonjwa",
    "name": "Jina Kamili", "dob": "Tarehe ya Kuzaliwa", "sex": "Jinsia",
    "phone": "Nambari ya Simu", "address": "Anwani", "id_number": "Nambari ya Kitambulisho",
    "hiv_status": "Hali ya VVU", "blood_group": "Kundi la Damu"
  },
  "clinical": {
    "vitals": "Dalili Muhimu", "weight": "Uzito (kg)", "height": "Urefu (cm)",
    "bp": "Shinikizo la Damu", "temp": "Joto (°C)", "pulse": "Mapigo (bpm)",
    "spo2": "SpO₂ (%)", "diagnosis": "Utambuzi", "prescription": "Dawa",
    "allergies": "Mzio", "chief_complaint": "Lalamiko Kuu",
    "history": "Historia ya Ugonjwa", "examination": "Uchunguzi",
    "plan": "Mpango wa Matibabu", "referral": "Rufaa", "follow_up": "Ufuatiliaji"
  },
  "billing": {
    "invoice": "Ankara", "payment": "Malipo", "insurance": "Bima",
    "cbhi": "Bima ya Jamii", "nhif": "NHIF", "receipt": "Stakabadhi"
  },
  "ai": {
    "cdss_recommendation": "Ushauri wa AI", "confidence": "Uhakika",
    "abstained": "AI ilijiepusha — hukumu ya kliniki inahitajika",
    "view_citations": "Ona Vyanzo", "disclaimer": "Msaada wa AI — thibitisha kimatibabu"
  },
  "common": {
    "save": "Hifadhi", "cancel": "Ghairi", "edit": "Hariri", "delete": "Futa",
    "search": "Tafuta", "filter": "Chuja", "export": "Hamisha", "print": "Chapisha",
    "loading": "Inapakia...", "error": "Hitilafu imetokea", "success": "Imehifadhiwa",
    "yes": "Ndiyo", "no": "Hapana", "required": "Inahitajika", "optional": "Si lazima",
    "date": "Tarehe", "time": "Wakati", "notes": "Maelezo", "status": "Hali"
  }
}
```

**File: `ehr-frontend/src/i18n/locales/zu.json`** — isiZulu:

```json
{
  "nav": {
    "dashboard": "Ibhodi Yokuphatha", "patients": "Iziguli", "appointments": "Izikhathi",
    "lab": "Ilabhorethri", "pharmacy": "Ukhemsisi", "billing": "Inkokhelo",
    "reports": "Imibiko", "settings": "Izilungiselelo"
  },
  "patient": {
    "register": "Bhalisa Isiguli", "search": "Sesha Isiguli",
    "name": "Igama Eligcwele", "dob": "Usuku Lokuzalwa", "sex": "Ubulili",
    "phone": "Inombolo Yocingo", "address": "Ikheli", "id_number": "Inombolo Kamazisi",
    "hiv_status": "Isimo se-HIV", "blood_group": "Iqembu Legazi"
  },
  "clinical": {
    "vitals": "Izibonakaliso Ezibalulekile", "weight": "Isisindo (kg)", "height": "Ubude (cm)",
    "bp": "Ingcindezi Yegazi", "temp": "Ubushisa (°C)", "pulse": "Ukushaya Kwenhliziyo (bpm)",
    "spo2": "SpO₂ (%)", "diagnosis": "Ukuhlonza Isifo", "prescription": "Umuthi",
    "allergies": "Ukungakwazi", "chief_complaint": "Isikhalazo Esiyinhloko",
    "history": "Umlando Wesifo", "examination": "Ukuhlolwa",
    "plan": "Uhlelo Lwemithi", "referral": "Ukudalwa", "follow_up": "Ukulandelela"
  },
  "billing": {
    "invoice": "Isicelo Senkokhelo", "payment": "Inkokhelo", "insurance": "Umshwalense",
    "cbhi": "Umshwalense Womphakathi", "nhif": "NHIF", "receipt": "Irisidi"
  },
  "ai": {
    "cdss_recommendation": "Iseluleko se-AI", "confidence": "Ukukhonza",
    "abstained": "I-AI izibalile — ukuhlolwa komtholampilo kuyadingeka",
    "view_citations": "Bona Imithombo", "disclaimer": "Isizinzo se-AI — qinisekisa ngokwezokwelapha"
  },
  "common": {
    "save": "Gcina", "cancel": "Khansela", "edit": "Hlela", "delete": "Susa",
    "search": "Sesha", "filter": "Hlunga", "export": "Thumela", "print": "Phrinta",
    "loading": "Iyalayisha...", "error": "Kukhona iphutha", "success": "Kugcinwe",
    "yes": "Yebo", "no": "Cha", "required": "Kudingekile", "optional": "Akudingeki",
    "date": "Usuku", "time": "Isikhathi", "notes": "Amanothi", "status": "Isimo"
  }
}
```

**File: `ehr-frontend/src/i18n/locales/af.json`** — Afrikaans:

```json
{
  "nav": {
    "dashboard": "Kontroleskerm", "patients": "Pasiënte", "appointments": "Afsprake",
    "lab": "Laboratorium", "pharmacy": "Apteek", "billing": "Fakturering",
    "reports": "Verslae", "settings": "Instellings"
  },
  "patient": {
    "register": "Registreer Pasiënt", "search": "Soek Pasiënt",
    "name": "Volle Naam", "dob": "Geboortedatum", "sex": "Geslag",
    "phone": "Telefoonnommer", "address": "Adres", "id_number": "ID-nommer",
    "hiv_status": "MIV-status", "blood_group": "Bloedgroep"
  },
  "clinical": {
    "vitals": "Lewenstekens", "weight": "Gewig (kg)", "height": "Lengte (cm)",
    "bp": "Bloeddruk", "temp": "Temperatuur (°C)", "pulse": "Pols (slae/min)",
    "spo2": "SpO₂ (%)", "diagnosis": "Diagnose", "prescription": "Voorskrif",
    "allergies": "Allergieë", "chief_complaint": "Hoofklagte",
    "history": "Geskiedenis van Huidige Siekte", "examination": "Ondersoek",
    "plan": "Behandelingsplan", "referral": "Verwysing", "follow_up": "Opvolg"
  },
  "billing": {
    "invoice": "Faktuur", "payment": "Betaling", "insurance": "Versekering",
    "cbhi": "Gemeenskapsgezondheidsversekering", "nhif": "NHIF", "receipt": "Kwitansie"
  },
  "ai": {
    "cdss_recommendation": "KI-Aanbeveling", "confidence": "Vertroue",
    "abstained": "KI het onthoud — kliniese oordeel benodig",
    "view_citations": "Sien Aanhalings", "disclaimer": "KI-ondersteund — verifieer klinies"
  },
  "common": {
    "save": "Stoor", "cancel": "Kanselleer", "edit": "Wysig", "delete": "Vee uit",
    "search": "Soek", "filter": "Filter", "export": "Uitvoer", "print": "Druk",
    "loading": "Laai...", "error": "Fout het opgetree", "success": "Gestoor",
    "yes": "Ja", "no": "Nee", "required": "Verpligtend", "optional": "Opsioneel",
    "date": "Datum", "time": "Tyd", "notes": "Notas", "status": "Status"
  }
}
```

Also create stub files for `sn.json` and `nd.json` with same key structure (Shona/Ndebele may already exist — check first, do not overwrite).

### 6d. Language Switcher Component

**File: `ehr-frontend/src/components/LanguageSwitcher.tsx`**

```tsx
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'pt', label: 'Português' },
  { code: 'fr', label: 'Français' },
  { code: 'sw', label: 'Kiswahili' },
  { code: 'zu', label: 'isiZulu' },
  { code: 'af', label: 'Afrikaans' },
  { code: 'sn', label: 'chiShona' },
  { code: 'nd', label: 'isiNdebele' },
];

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();

  return (
    <div className="flex items-center gap-2">
      <Globe className="w-4 h-4 text-gray-500" />
      <select
        value={i18n.language}
        onChange={e => i18n.changeLanguage(e.target.value)}
        className="text-sm border border-gray-300 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        {LANGUAGES.map(l => (
          <option key={l.code} value={l.code}>{l.label}</option>
        ))}
      </select>
    </div>
  );
}
```

Place `<LanguageSwitcher />` in the top navigation bar in `App.tsx` or `Layout.tsx`.

### 6e. Usage pattern in components

Replace all hardcoded strings with `useTranslation()`:

```tsx
import { useTranslation } from 'react-i18next';

export default function PatientsPage() {
  const { t } = useTranslation();
  return (
    <div>
      <h1>{t('patient.search')}</h1>
      <button>{t('patient.register')}</button>
    </div>
  );
}
```

Update at minimum: navigation labels, patient registration form labels, clinical vitals labels, billing section labels, and all CDSS result display text (confidence, abstained, disclaimer).

### 6f. API in `api.ts`

```typescript
export const languageApi = {
  getUserLanguage: (userId: string) => api.get(`/settings/language/${userId}`),
  setUserLanguage: (userId: string, data: { uiLanguage: string; clinicalNoteLanguage?: string }) =>
    api.put(`/settings/language/${userId}`, data),
  getSupportedLanguages: () => api.get('/settings/languages'),
};
```

---

## 7. Post-Implementation Steps

```bash
# 1. Install frontend deps
cd ehr-frontend && npm install i18next react-i18next i18next-browser-languagedetector

# 2. Rebuild tenant-service
cd .. && docker compose build tenant-service

# 3. Provision
./scripts/provision-repair-all.sh
# Fallback: curl -X POST http://localhost:3001/admin/tenants/repair-all -H "Authorization: Bearer <token>"

# 4. Verify table
psql $DATABASE_URL -c "\d user_language_preferences"

# 5. TypeScript check
npx tsc --noEmit

# 6. Verify translations load
# Start frontend, switch to French → all nav labels should be in French
# Switch to Portuguese → all nav labels should be in Portuguese

# 7. Lint
npm run lint

# 8. Commit
git add services/tenant-service/src/generated/tenant-language-preferences.statements.ts \
        services/ehr-service/src/settings/ \
        ehr-frontend/src/i18n/ \
        ehr-frontend/src/components/LanguageSwitcher.tsx \
        ehr-frontend/src/services/api.ts
git commit -m "feat: implement Sprint 155 — i18n framework with Portuguese, French, Swahili, Zulu, Afrikaans"
```

---

## 8. Done-When Checklist

- [ ] `npm install i18next react-i18next i18next-browser-languagedetector` complete
- [ ] `tenant-language-preferences.statements.ts` with `user_language_preferences` table
- [ ] Bundle registered in `database-provisioning.service.ts`
- [ ] `UserLanguagePreference` TypeORM entity registered in `tenant.service.ts`
- [ ] `LanguageService` + `LanguageController` (GET/PUT `/settings/language`, GET `/settings/languages`)
- [ ] `LanguageModule` in `ehr.module.ts`
- [ ] `ehr-frontend/src/i18n/index.ts` — i18n configured with LanguageDetector + localStorage persistence
- [ ] Translation files for all 8 languages (`en`, `pt`, `fr`, `sw`, `zu`, `af`, `sn`, `nd`) — all 100+ keys
- [ ] `LanguageSwitcher.tsx` component in top navigation
- [ ] All navigation labels, patient form labels, clinical labels use `t()` keys
- [ ] CDSS result display text (`abstained`, `confidence`, `disclaimer`) uses `t()` keys
- [ ] CDSS top-5 endpoints accept `locale` parameter and localise response text
- [ ] `languageApi` in `ehr-frontend/src/services/api.ts`
- [ ] Switching to French → UI in French; switching to Portuguese → UI in Portuguese
- [ ] `provision-repair-all.sh` clean
- [ ] `npx tsc --noEmit` — 0 errors
- [ ] `npm run lint` — 0 errors
- [ ] Git committed: `feat: implement Sprint 155 — i18n framework with Portuguese, French, Swahili, Zulu, Afrikaans`
