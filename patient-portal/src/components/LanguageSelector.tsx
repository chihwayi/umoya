import React from 'react';
import { useTranslation } from 'react-i18next';
import { runtimeUrls } from '../config/runtime';

const API_BASE_URL = runtimeUrls.ehrApi;

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'sn', label: 'ChiShona' },
  { code: 'nd', label: 'IsiNdebele' },
  { code: 'pt', label: 'Português' },
  { code: 'fr', label: 'Français' },
  { code: 'sw', label: 'Kiswahili' },
  { code: 'zu', label: 'isiZulu' },
  { code: 'af', label: 'Afrikaans' },
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
      try {
        const token = localStorage.getItem('patient_token');
        const tenantSlug = localStorage.getItem('patient_tenant');
        await fetch(`${API_BASE_URL}/preferences/language`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-Tenant-ID': tenantSlug ?? '',
            Authorization: `Bearer ${token ?? ''}`,
          },
          body: JSON.stringify({ language: lang, entityType: 'patient', entityId: patientId }),
        });
      } catch {
        // Non-critical — language still changed locally
      }
    }

    onChanged?.(lang);
  };

  return (
    <select
      value={i18n.language.slice(0, 2)}
      onChange={(e) => handleChange(e.target.value)}
      aria-label="Select language"
      style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 13, cursor: 'pointer' }}
    >
      {LANGUAGES.map((l) => (
        <option key={l.code} value={l.code}>{l.label}</option>
      ))}
    </select>
  );
};
