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

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const lang = e.target.value;
    i18n.changeLanguage(lang);
    localStorage.setItem('umoya_language', lang);
  };

  return (
    <div className="flex items-center gap-1.5">
      <Globe className="w-4 h-4 text-white/70 flex-shrink-0" />
      <select
        value={i18n.language?.split('-')[0] ?? 'en'}
        onChange={handleChange}
        className="text-sm bg-white/10 border border-white/20 text-white rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-white/40 cursor-pointer"
      >
        {LANGUAGES.map(l => (
          <option key={l.code} value={l.code} className="text-gray-800 bg-white">
            {l.label}
          </option>
        ))}
      </select>
    </div>
  );
}
