export interface CrossReactivityEntry {
  relatedClasses: string[];
  riskLevel: 'low' | 'moderate' | 'high';
  message: string;
}

export const CROSS_REACTIVITY_MAP: Record<string, CrossReactivityEntry> = {
  penicillin: {
    relatedClasses: ['cephalosporin', 'carbapenem', 'amoxicillin', 'ampicillin', 'piperacillin', 'nafcillin', 'oxacillin', 'dicloxacillin', 'flucloxacillin'],
    riskLevel: 'moderate',
    message: '1-2% cross-reactivity risk with cephalosporins; avoid carbapenems if anaphylaxis history.',
  },
  cephalosporin: {
    relatedClasses: ['penicillin', 'carbapenem', 'cefazolin', 'ceftriaxone', 'cephalexin', 'cefuroxime'],
    riskLevel: 'moderate',
    message: 'Cross-reactivity with penicillins; consider skin testing if severe penicillin allergy.',
  },
  sulfonamide: {
    relatedClasses: ['sulfonylurea', 'thiazide', 'sulfasalazine', 'dapsone', 'trimethoprim-sulfamethoxazole', 'cotrimoxazole'],
    riskLevel: 'low',
    message: 'Low cross-reactivity risk between sulfonamide antibiotics and non-antibiotic sulfonamides; monitor for hypersensitivity.',
  },
  nsaid: {
    relatedClasses: ['aspirin', 'salicylate', 'cox2_inhibitor', 'ibuprofen', 'naproxen', 'diclofenac', 'piroxicam', 'indomethacin', 'meloxicam', 'ketorolac', 'celecoxib'],
    riskLevel: 'high',
    message: 'Cross-reactivity between NSAIDs is common (COX-1 mediated); avoid entire class unless COX-2 selective tested safe.',
  },
  aspirin: {
    relatedClasses: ['nsaid', 'salicylate', 'ibuprofen', 'naproxen', 'diclofenac'],
    riskLevel: 'high',
    message: 'Aspirin-exacerbated respiratory disease (AERD) — avoid all NSAIDs. COX-2 selective may be tolerated under supervision.',
  },
  ace_inhibitor: {
    relatedClasses: ['lisinopril', 'enalapril', 'ramipril', 'captopril', 'perindopril', 'benazepril', 'fosinopril', 'quinapril'],
    riskLevel: 'high',
    message: 'ACE inhibitor angioedema is class-wide. ARBs carry ~10% cross-reactivity risk; use with extreme caution.',
  },
  morphine: {
    relatedClasses: ['codeine', 'hydromorphone', 'oxycodone', 'hydrocodone', 'fentanyl', 'methadone', 'tramadol'],
    riskLevel: 'moderate',
    message: 'Opioid cross-reactivity varies. True allergy is rare (usually pseudoallergy/histamine release). Consider alternative opioid structure.',
  },
  latex: {
    relatedClasses: ['banana', 'avocado', 'kiwi', 'chestnut'],
    riskLevel: 'moderate',
    message: 'Latex-fruit syndrome: cross-reactivity with banana, avocado, kiwi, and chestnut proteins.',
  },
  egg: {
    relatedClasses: ['influenza_vaccine', 'yellow_fever_vaccine'],
    riskLevel: 'moderate',
    message: 'Egg allergy — influenza and yellow fever vaccines are egg-cultured. MMR and rabies vaccines are generally safe.',
  },
};

export const DRUG_CLASS_MEMBERS: Record<string, string[]> = {
  penicillin: ['amoxicillin', 'ampicillin', 'penicillin', 'piperacillin', 'nafcillin', 'oxacillin', 'dicloxacillin', 'flucloxacillin', 'augmentin', 'co-amoxiclav'],
  cephalosporin: ['cefazolin', 'cephalexin', 'cefuroxime', 'ceftriaxone', 'cefotaxime', 'ceftazidime', 'cefixime', 'cefepime', 'cefdinir'],
  carbapenem: ['meropenem', 'imipenem', 'ertapenem', 'doripenem'],
  sulfonamide: ['sulfamethoxazole', 'trimethoprim-sulfamethoxazole', 'cotrimoxazole', 'bactrim', 'septrin', 'sulfasalazine', 'dapsone'],
  nsaid: ['ibuprofen', 'naproxen', 'diclofenac', 'piroxicam', 'indomethacin', 'meloxicam', 'ketorolac', 'mefenamic acid', 'flurbiprofen'],
  cox2_inhibitor: ['celecoxib', 'etoricoxib'],
  salicylate: ['aspirin', 'acetylsalicylic acid', 'diflunisal', 'salsalate'],
  ace_inhibitor: ['lisinopril', 'enalapril', 'ramipril', 'captopril', 'perindopril', 'benazepril', 'fosinopril', 'quinapril', 'trandolapril'],
  opioid: ['morphine', 'codeine', 'hydromorphone', 'oxycodone', 'hydrocodone', 'fentanyl', 'methadone', 'tramadol', 'pethidine', 'meperidine'],
  statin: ['atorvastatin', 'rosuvastatin', 'simvastatin', 'pravastatin', 'fluvastatin', 'lovastatin', 'pitavastatin'],
  fluoroquinolone: ['ciprofloxacin', 'levofloxacin', 'moxifloxacin', 'ofloxacin', 'norfloxacin'],
  macrolide: ['azithromycin', 'clarithromycin', 'erythromycin'],
  tetracycline: ['doxycycline', 'tetracycline', 'minocycline'],
};
