export interface CountryPack {
  countryCode: string;
  countryName: string;
  currency: string;
  currencySymbol: string;
  languages: string[];
  phoneCountryCode: string;
  dateFormat: string;
  nationalIdLabel: string;
  insuranceLabel: string;
  smsProvider: 'africas_talking' | 'twilio' | 'none';
  dhis2Enabled: boolean;
  crvsEnabled: boolean;
  nhifEnabled: boolean;
  defaultDeploymentMode: 'clinic' | 'hospital' | 'ministry';
}

const COUNTRY_PACKS: Record<string, CountryPack> = {
  ZW: {
    countryCode: 'ZW',
    countryName: 'Zimbabwe',
    currency: 'USD',
    currencySymbol: '$',
    languages: ['en', 'sn', 'nd'],
    phoneCountryCode: '+263',
    dateFormat: 'DD/MM/YYYY',
    nationalIdLabel: 'National ID',
    insuranceLabel: 'NHIF',
    smsProvider: 'africas_talking',
    dhis2Enabled: true,
    crvsEnabled: true,
    nhifEnabled: true,
    defaultDeploymentMode: 'clinic',
  },
  ZM: {
    countryCode: 'ZM',
    countryName: 'Zambia',
    currency: 'ZMW',
    currencySymbol: 'K',
    languages: ['en'],
    phoneCountryCode: '+260',
    dateFormat: 'DD/MM/YYYY',
    nationalIdLabel: 'NRC Number',
    insuranceLabel: 'NHIMA',
    smsProvider: 'africas_talking',
    dhis2Enabled: true,
    crvsEnabled: true,
    nhifEnabled: true,
    defaultDeploymentMode: 'clinic',
  },
  ZA: {
    countryCode: 'ZA',
    countryName: 'South Africa',
    currency: 'ZAR',
    currencySymbol: 'R',
    languages: ['en', 'zu', 'xh', 'af'],
    phoneCountryCode: '+27',
    dateFormat: 'DD/MM/YYYY',
    nationalIdLabel: 'ID Number',
    insuranceLabel: 'Medical Aid',
    smsProvider: 'africas_talking',
    dhis2Enabled: true,
    crvsEnabled: true,
    nhifEnabled: false,
    defaultDeploymentMode: 'hospital',
  },
  KE: {
    countryCode: 'KE',
    countryName: 'Kenya',
    currency: 'KES',
    currencySymbol: 'KSh',
    languages: ['en', 'sw'],
    phoneCountryCode: '+254',
    dateFormat: 'DD/MM/YYYY',
    nationalIdLabel: 'National ID',
    insuranceLabel: 'NHIF',
    smsProvider: 'africas_talking',
    dhis2Enabled: true,
    crvsEnabled: true,
    nhifEnabled: true,
    defaultDeploymentMode: 'clinic',
  },
  NG: {
    countryCode: 'NG',
    countryName: 'Nigeria',
    currency: 'NGN',
    currencySymbol: '₦',
    languages: ['en'],
    phoneCountryCode: '+234',
    dateFormat: 'DD/MM/YYYY',
    nationalIdLabel: 'NIN',
    insuranceLabel: 'NHIS',
    smsProvider: 'africas_talking',
    dhis2Enabled: true,
    crvsEnabled: false,
    nhifEnabled: false,
    defaultDeploymentMode: 'clinic',
  },
  GH: {
    countryCode: 'GH',
    countryName: 'Ghana',
    currency: 'GHS',
    currencySymbol: 'GH₵',
    languages: ['en'],
    phoneCountryCode: '+233',
    dateFormat: 'DD/MM/YYYY',
    nationalIdLabel: 'Ghana Card',
    insuranceLabel: 'NHIA',
    smsProvider: 'africas_talking',
    dhis2Enabled: true,
    crvsEnabled: false,
    nhifEnabled: false,
    defaultDeploymentMode: 'clinic',
  },
};

const DEFAULT_COUNTRY_PACK: CountryPack = {
  countryCode: 'ZW',
  countryName: 'Zimbabwe',
  currency: 'USD',
  currencySymbol: '$',
  languages: ['en'],
  phoneCountryCode: '+263',
  dateFormat: 'DD/MM/YYYY',
  nationalIdLabel: 'National ID',
  insuranceLabel: 'Insurance',
  smsProvider: 'africas_talking',
  dhis2Enabled: false,
  crvsEnabled: false,
  nhifEnabled: false,
  defaultDeploymentMode: 'clinic',
};

export function getCountryPack(countryCode?: string | null): CountryPack {
  if (!countryCode) return DEFAULT_COUNTRY_PACK;
  return COUNTRY_PACKS[countryCode.toUpperCase()] ?? DEFAULT_COUNTRY_PACK;
}

export function listCountryPacks(): CountryPack[] {
  return Object.values(COUNTRY_PACKS);
}
