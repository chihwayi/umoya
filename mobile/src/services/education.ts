import { api } from './api';
import i18n from '../i18n';
import { useAuthStore } from '../stores/useAuthStore';

export interface EducationCategory {
  id: string;
  label: string;
  icon?: string;
}

export interface EducationArticle {
  id: string;
  title: string;
  summary: string;
  category: string;
  readingTimeMinutes?: number;
  tags?: string[];
  publishedAt?: string;
}

export interface EducationArticleDetail extends EducationArticle {
  body: string;            // HTML or Markdown - render with a WebView or Markdown renderer
  sourceUrl?: string;
  authorName?: string;
}

interface PatientEducationMaterial {
  id: string;
  topic: string;
  language?: string;
  content?: string;
  contentHtml?: string;
  readingLevel?: number;
  createdAt?: string;
  updatedAt?: string;
  aiGenerated?: boolean;
}

const locale = () => i18n.language ?? 'en';

const currentPatient = () => {
  const { user, tenant } = useAuthStore.getState();
  return {
    patientId: user?.patientMrn ?? user?.id ?? '',
    subdomain: tenant?.slug ?? user?.tenantSlug ?? '',
  };
};

const normalizeCategory = (topic?: string) => {
  const text = (topic ?? 'general').toLowerCase();
  if (text.includes('hiv') || text.includes('art')) return 'hiv';
  if (text.includes('tb') || text.includes('tuberculosis')) return 'tb';
  if (text.includes('maternal') || text.includes('pregnancy') || text.includes('antenatal')) return 'maternal';
  if (text.includes('diabetes') || text.includes('hypertension') || text.includes('ncd')) return 'ncd';
  return 'general';
};

const labelForCategory = (id: string) => {
  const labels: Record<string, string> = {
    hiv: 'HIV',
    tb: 'TB',
    maternal: 'Maternal Health',
    ncd: 'Chronic Conditions',
    general: 'General Health',
  };
  return labels[id] ?? id;
};

const stripHtml = (html?: string) => (html ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const matchesLocale = (item: PatientEducationMaterial) => {
  if (!item.language) return true;
  return item.language.toLowerCase().startsWith(locale().toLowerCase());
};

const materialToArticle = (item: PatientEducationMaterial): EducationArticle => {
  const plain = stripHtml(item.contentHtml) || item.content || '';
  return {
    id: item.id,
    title: item.topic || 'Health Education',
    summary: plain.slice(0, 180) || item.topic || '',
    category: normalizeCategory(item.topic),
    readingTimeMinutes: Math.max(1, Math.ceil((plain.split(/\s+/).filter(Boolean).length || 120) / 180)),
    tags: [normalizeCategory(item.topic), item.language].filter(Boolean) as string[],
    publishedAt: item.createdAt ?? item.updatedAt,
  };
};

const getMaterials = async () => {
  const { patientId, subdomain } = currentPatient();
  if (!patientId || !subdomain) return [];
  const qs = new URLSearchParams({ subdomain, locale: locale() }).toString();
  return api.get<PatientEducationMaterial[]>(`/education/patient/${patientId}?${qs}`).then(r => r.data ?? []);
};

export const EducationService = {
  getCategories: async () => {
    const materials = (await getMaterials()).filter(matchesLocale);
    const ids = Array.from(new Set(materials.map(item => normalizeCategory(item.topic))));
    const normalized = ids.length ? ids : ['general'];
    return normalized.map(id => ({ id, label: labelForCategory(id), icon: id } as EducationCategory));
  },

  getContent: async (category?: string) => {
    const materials = (await getMaterials()).filter(matchesLocale);
    return materials
      .map(materialToArticle)
      .filter(article => !category || article.category === category);
  },

  getArticle: async (id: string) => {
    const materials = (await getMaterials()).filter(matchesLocale);
    const item = materials.find(material => material.id === id);
    if (!item) throw new Error('Education article not found');
    return {
      ...materialToArticle(item),
      body: item.contentHtml || `<p>${(item.content ?? '').replace(/\n/g, '</p><p>')}</p>`,
      authorName: item.aiGenerated ? 'MediCore AI' : undefined,
    } as EducationArticleDetail;
  },
};
