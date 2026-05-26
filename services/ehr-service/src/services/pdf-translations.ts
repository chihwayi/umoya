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
