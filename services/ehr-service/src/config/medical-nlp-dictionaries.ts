export interface AllergenEntry {
  name: string;
  aliases: string[];
  snomedCode: string;
  snomedTerm: string;
  category: 'drug' | 'food' | 'environmental' | 'biological' | 'other';
}

export interface ReactionEntry {
  name: string;
  aliases: string[];
  snomedCode: string;
  snomedTerm: string;
}

export const ALLERGEN_DICTIONARY: AllergenEntry[] = [
  // Drugs
  { name: 'penicillin', aliases: ['penicillin', 'pcn', 'pen', 'pen v', 'pen g'], snomedCode: '764146007', snomedTerm: 'Penicillin', category: 'drug' },
  { name: 'amoxicillin', aliases: ['amoxicillin', 'amoxil', 'augmentin', 'amoxyclav'], snomedCode: '27658006', snomedTerm: 'Amoxicillin', category: 'drug' },
  { name: 'ampicillin', aliases: ['ampicillin'], snomedCode: '387170002', snomedTerm: 'Ampicillin', category: 'drug' },
  { name: 'cephalosporin', aliases: ['cephalosporin', 'cephalexin', 'keflex', 'ceftriaxone', 'cefazolin', 'cefuroxime'], snomedCode: '373262006', snomedTerm: 'Cephalosporin', category: 'drug' },
  { name: 'sulfonamide', aliases: ['sulfa', 'sulfonamide', 'sulfamethoxazole', 'bactrim', 'septrin', 'cotrimoxazole', 'tmp-smx'], snomedCode: '363664003', snomedTerm: 'Sulfonamide', category: 'drug' },
  { name: 'erythromycin', aliases: ['erythromycin', 'e-mycin', 'eryc'], snomedCode: '372694001', snomedTerm: 'Erythromycin', category: 'drug' },
  { name: 'azithromycin', aliases: ['azithromycin', 'zithromax', 'z-pack'], snomedCode: '387531004', snomedTerm: 'Azithromycin', category: 'drug' },
  { name: 'clarithromycin', aliases: ['clarithromycin', 'biaxin'], snomedCode: '387487009', snomedTerm: 'Clarithromycin', category: 'drug' },
  { name: 'ciprofloxacin', aliases: ['ciprofloxacin', 'cipro', 'ciproxin'], snomedCode: '372840008', snomedTerm: 'Ciprofloxacin', category: 'drug' },
  { name: 'fluoroquinolone', aliases: ['fluoroquinolone', 'levofloxacin', 'moxifloxacin', 'levaquin'], snomedCode: '419241000', snomedTerm: 'Fluoroquinolone', category: 'drug' },
  { name: 'tetracycline', aliases: ['tetracycline', 'doxycycline', 'minocycline'], snomedCode: '372809001', snomedTerm: 'Tetracycline', category: 'drug' },
  { name: 'metronidazole', aliases: ['metronidazole', 'flagyl'], snomedCode: '372602008', snomedTerm: 'Metronidazole', category: 'drug' },
  { name: 'vancomycin', aliases: ['vancomycin', 'vancocin'], snomedCode: '372735009', snomedTerm: 'Vancomycin', category: 'drug' },
  { name: 'aspirin', aliases: ['aspirin', 'asa', 'acetylsalicylic acid', 'acetylsalicylic'], snomedCode: '387458008', snomedTerm: 'Aspirin', category: 'drug' },
  { name: 'ibuprofen', aliases: ['ibuprofen', 'advil', 'motrin', 'brufen', 'nurofen'], snomedCode: '387207008', snomedTerm: 'Ibuprofen', category: 'drug' },
  { name: 'naproxen', aliases: ['naproxen', 'aleve', 'naprosyn'], snomedCode: '372588000', snomedTerm: 'Naproxen', category: 'drug' },
  { name: 'diclofenac', aliases: ['diclofenac', 'voltaren'], snomedCode: '7034005', snomedTerm: 'Diclofenac', category: 'drug' },
  { name: 'nsaid', aliases: ['nsaid', 'nsaids', 'non-steroidal anti-inflammatory'], snomedCode: '372665008', snomedTerm: 'NSAID', category: 'drug' },
  { name: 'codeine', aliases: ['codeine'], snomedCode: '387494007', snomedTerm: 'Codeine', category: 'drug' },
  { name: 'morphine', aliases: ['morphine'], snomedCode: '373529000', snomedTerm: 'Morphine', category: 'drug' },
  { name: 'tramadol', aliases: ['tramadol', 'ultram'], snomedCode: '386858008', snomedTerm: 'Tramadol', category: 'drug' },
  { name: 'oxycodone', aliases: ['oxycodone', 'oxycontin', 'percocet'], snomedCode: '55452001', snomedTerm: 'Oxycodone', category: 'drug' },
  { name: 'metformin', aliases: ['metformin', 'glucophage'], snomedCode: '372567009', snomedTerm: 'Metformin', category: 'drug' },
  { name: 'insulin', aliases: ['insulin'], snomedCode: '67866001', snomedTerm: 'Insulin', category: 'drug' },
  { name: 'methotrexate', aliases: ['methotrexate', 'mtx'], snomedCode: '387381009', snomedTerm: 'Methotrexate', category: 'drug' },
  { name: 'lisinopril', aliases: ['lisinopril', 'zestril', 'prinivil'], snomedCode: '386873009', snomedTerm: 'Lisinopril', category: 'drug' },
  { name: 'ace inhibitor', aliases: ['ace inhibitor', 'enalapril', 'ramipril', 'captopril'], snomedCode: '41549009', snomedTerm: 'ACE inhibitor', category: 'drug' },
  { name: 'statin', aliases: ['statin', 'atorvastatin', 'simvastatin', 'rosuvastatin', 'lipitor', 'crestor'], snomedCode: '372912004', snomedTerm: 'HMG-CoA reductase inhibitor', category: 'drug' },
  { name: 'warfarin', aliases: ['warfarin', 'coumadin'], snomedCode: '372756006', snomedTerm: 'Warfarin', category: 'drug' },
  { name: 'heparin', aliases: ['heparin'], snomedCode: '372877000', snomedTerm: 'Heparin', category: 'drug' },
  { name: 'phenytoin', aliases: ['phenytoin', 'dilantin'], snomedCode: '387220006', snomedTerm: 'Phenytoin', category: 'drug' },
  { name: 'carbamazepine', aliases: ['carbamazepine', 'tegretol'], snomedCode: '387222003', snomedTerm: 'Carbamazepine', category: 'drug' },
  { name: 'lamotrigine', aliases: ['lamotrigine', 'lamictal'], snomedCode: '387562000', snomedTerm: 'Lamotrigine', category: 'drug' },
  { name: 'allopurinol', aliases: ['allopurinol', 'zyloprim'], snomedCode: '387135004', snomedTerm: 'Allopurinol', category: 'drug' },
  { name: 'local anaesthetic', aliases: ['lidocaine', 'lignocaine', 'bupivacaine', 'local anaesthetic', 'local anesthetic'], snomedCode: '386761002', snomedTerm: 'Lidocaine', category: 'drug' },

  // Foods
  { name: 'peanut', aliases: ['peanut', 'peanuts', 'groundnut', 'groundnuts'], snomedCode: '762952008', snomedTerm: 'Peanut', category: 'food' },
  { name: 'tree nut', aliases: ['tree nut', 'tree nuts', 'almond', 'walnut', 'cashew', 'pistachio', 'hazelnut', 'brazil nut', 'macadamia', 'pecan'], snomedCode: '91934008', snomedTerm: 'Tree nut', category: 'food' },
  { name: 'shellfish', aliases: ['shellfish', 'shrimp', 'crab', 'lobster', 'prawn', 'prawns', 'crustacean'], snomedCode: '735029006', snomedTerm: 'Shellfish', category: 'food' },
  { name: 'fish', aliases: ['fish', 'seafood'], snomedCode: '417532002', snomedTerm: 'Fish', category: 'food' },
  { name: 'egg', aliases: ['egg', 'eggs', 'egg white', 'egg yolk'], snomedCode: '102263004', snomedTerm: 'Egg protein', category: 'food' },
  { name: 'milk', aliases: ['milk', 'dairy', 'lactose', 'casein', 'cow milk', "cow's milk"], snomedCode: '3718001', snomedTerm: 'Cow milk protein', category: 'food' },
  { name: 'wheat', aliases: ['wheat', 'gluten'], snomedCode: '412071004', snomedTerm: 'Wheat', category: 'food' },
  { name: 'soy', aliases: ['soy', 'soya', 'soybean', 'soy bean'], snomedCode: '256349002', snomedTerm: 'Soy protein', category: 'food' },
  { name: 'sesame', aliases: ['sesame', 'sesame seed'], snomedCode: '256350002', snomedTerm: 'Sesame', category: 'food' },
  { name: 'corn', aliases: ['corn', 'maize'], snomedCode: '735215001', snomedTerm: 'Corn', category: 'food' },
  { name: 'strawberry', aliases: ['strawberry', 'strawberries'], snomedCode: '264337003', snomedTerm: 'Strawberry', category: 'food' },
  { name: 'banana', aliases: ['banana'], snomedCode: '256306003', snomedTerm: 'Banana', category: 'food' },
  { name: 'kiwi', aliases: ['kiwi', 'kiwi fruit'], snomedCode: '260175008', snomedTerm: 'Kiwi fruit', category: 'food' },
  { name: 'chocolate', aliases: ['chocolate', 'cocoa'], snomedCode: '227426008', snomedTerm: 'Chocolate', category: 'food' },

  // Environmental
  { name: 'latex', aliases: ['latex', 'rubber', 'natural rubber latex'], snomedCode: '111088007', snomedTerm: 'Latex', category: 'environmental' },
  { name: 'pollen', aliases: ['pollen', 'hay fever', 'grass pollen', 'tree pollen', 'ragweed'], snomedCode: '256259004', snomedTerm: 'Pollen', category: 'environmental' },
  { name: 'dust mite', aliases: ['dust', 'dust mite', 'house dust', 'house dust mite'], snomedCode: '260147004', snomedTerm: 'Dust mite', category: 'environmental' },
  { name: 'mold', aliases: ['mold', 'mould', 'fungus', 'fungi'], snomedCode: '84489001', snomedTerm: 'Mold', category: 'environmental' },
  { name: 'animal dander', aliases: ['cat', 'dog', 'pet', 'animal dander', 'cat dander', 'dog dander', 'pet dander'], snomedCode: '264287008', snomedTerm: 'Animal dander', category: 'environmental' },
  { name: 'bee venom', aliases: ['bee', 'bee sting', 'wasp', 'hornet', 'bee venom', 'wasp sting'], snomedCode: '288328004', snomedTerm: 'Bee venom', category: 'environmental' },
  { name: 'nickel', aliases: ['nickel'], snomedCode: '33396006', snomedTerm: 'Nickel', category: 'environmental' },

  // Other
  { name: 'contrast dye', aliases: ['contrast', 'iodine contrast', 'contrast dye', 'iv contrast', 'iodinated contrast', 'contrast media'], snomedCode: '426722004', snomedTerm: 'Iodinated contrast media', category: 'other' },
  { name: 'adhesive tape', aliases: ['adhesive', 'tape', 'plaster', 'band-aid'], snomedCode: '256440004', snomedTerm: 'Adhesive tape', category: 'other' },
];

export const REACTION_DICTIONARY: ReactionEntry[] = [
  { name: 'anaphylaxis', aliases: ['anaphylaxis', 'anaphylactic', 'anaphylactic shock', 'anaphylactic reaction'], snomedCode: '39579001', snomedTerm: 'Anaphylaxis' },
  { name: 'urticaria', aliases: ['urticaria', 'hives', 'wheals'], snomedCode: '126485001', snomedTerm: 'Urticaria' },
  { name: 'rash', aliases: ['rash', 'skin rash', 'dermatitis', 'eruption', 'skin eruption', 'maculopapular rash'], snomedCode: '271807003', snomedTerm: 'Skin rash' },
  { name: 'angioedema', aliases: ['angioedema', 'facial swelling', 'lip swelling', 'tongue swelling', 'throat swelling'], snomedCode: '41291007', snomedTerm: 'Angioedema' },
  { name: 'bronchospasm', aliases: ['bronchospasm', 'wheezing', 'breathing difficulty', 'dyspnea', 'shortness of breath', 'respiratory distress'], snomedCode: '4386001', snomedTerm: 'Bronchospasm' },
  { name: 'nausea', aliases: ['nausea', 'vomiting', 'gi upset', 'stomach upset', 'nausea/vomiting', 'emesis', 'gi distress'], snomedCode: '422587007', snomedTerm: 'Nausea and vomiting' },
  { name: 'diarrhea', aliases: ['diarrhea', 'diarrhoea', 'loose stool', 'loose stools'], snomedCode: '62315008', snomedTerm: 'Diarrhea' },
  { name: 'itching', aliases: ['itching', 'pruritus', 'itch', 'itchiness'], snomedCode: '418290006', snomedTerm: 'Pruritus' },
  { name: 'swelling', aliases: ['swelling', 'edema', 'oedema'], snomedCode: '65124004', snomedTerm: 'Swelling' },
  { name: 'fever', aliases: ['fever', 'pyrexia', 'febrile'], snomedCode: '386661006', snomedTerm: 'Fever' },
  { name: 'cough', aliases: ['cough', 'coughing'], snomedCode: '49727002', snomedTerm: 'Cough' },
  { name: 'dizziness', aliases: ['dizziness', 'dizzy', 'lightheaded', 'vertigo'], snomedCode: '404640003', snomedTerm: 'Dizziness' },
  { name: 'headache', aliases: ['headache'], snomedCode: '25064002', snomedTerm: 'Headache' },
  { name: 'hypotension', aliases: ['hypotension', 'low blood pressure', 'drop in blood pressure'], snomedCode: '45007003', snomedTerm: 'Hypotension' },
  { name: 'tachycardia', aliases: ['tachycardia', 'rapid heart rate', 'palpitations'], snomedCode: '3424008', snomedTerm: 'Tachycardia' },
  { name: 'serum sickness', aliases: ['serum sickness', 'serum sickness-like'], snomedCode: '111210004', snomedTerm: 'Serum sickness' },
  { name: 'stevens-johnson syndrome', aliases: ['stevens-johnson', 'sjs', 'toxic epidermal necrolysis', 'ten', 'sjs/ten'], snomedCode: '73442001', snomedTerm: 'Stevens-Johnson syndrome' },
  { name: 'drug rash', aliases: ['drug rash', 'drug eruption', 'drug reaction', 'fixed drug eruption'], snomedCode: '111209009', snomedTerm: 'Drug eruption' },
  { name: 'contact dermatitis', aliases: ['contact dermatitis', 'contact allergy'], snomedCode: '40275004', snomedTerm: 'Contact dermatitis' },
  { name: 'rhinitis', aliases: ['rhinitis', 'runny nose', 'nasal congestion', 'sneezing'], snomedCode: '70076002', snomedTerm: 'Rhinitis' },
];

export const SEVERITY_MAP: Record<string, 'mild' | 'moderate' | 'severe'> = {
  mild: 'mild', minor: 'mild', slight: 'mild', low: 'mild', minimal: 'mild',
  moderate: 'moderate', medium: 'moderate',
  severe: 'severe', serious: 'severe', 'life-threatening': 'severe',
  'life threatening': 'severe', anaphylaxis: 'severe', anaphylactic: 'severe',
  critical: 'severe', fatal: 'severe', dangerous: 'severe',
};
