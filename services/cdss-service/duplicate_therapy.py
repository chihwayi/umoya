"""
Duplicate Therapy Detection
Identifies:
- Same medication class duplicates
- Overlapping prescriptions
- Therapeutic duplications
"""
from typing import List, Dict, Optional, Any
from datetime import datetime


class DuplicateTherapyDetector:
    """Detects duplicate or overlapping medication therapy"""
    
    # Medication class mappings (simplified - comprehensive in production)
    DRUG_CLASSES = {
        # ACE Inhibitors
        'ace_inhibitor': ['lisinopril', 'enalapril', 'captopril', 'ramipril', 'benazepril', 'fosinopril', 'quinapril', 'trandolapril'],
        
        # ARBs
        'arb': ['losartan', 'valsartan', 'irbesartan', 'candesartan', 'telmisartan', 'olmesartan', 'azilsartan'],
        
        # Beta Blockers
        'beta_blocker': ['metoprolol', 'atenolol', 'propranolol', 'bisoprolol', 'carvedilol', 'labetalol', 'nebivolol', 'acebutolol'],
        
        # Calcium Channel Blockers
        'ccb': ['amlodipine', 'nifedipine', 'diltiazem', 'verapamil', 'felodipine', 'isradipine'],
        
        # Diuretics
        'thiazide': ['hydrochlorothiazide', 'chlorthalidone', 'indapamide'],
        'loop_diuretic': ['furosemide', 'bumetanide', 'torsemide', 'ethacrynic'],
        'potassium_sparing': ['spironolactone', 'eplerenone', 'amiloride', 'triamterene'],
        
        # Statins
        'statin': ['atorvastatin', 'simvastatin', 'rosuvastatin', 'pravastatin', 'lovastatin', 'fluvastatin'],
        
        # SSRIs
        'ssri': ['sertraline', 'fluoxetine', 'paroxetine', 'citalopram', 'escitalopram', 'fluvoxamine'],
        
        # NSAIDs
        'nsaid': ['ibuprofen', 'naproxen', 'diclofenac', 'indomethacin', 'meloxicam', 'celecoxib', 'aspirin'],
        
        # Opioids
        'opioid': ['morphine', 'oxycodone', 'hydrocodone', 'codeine', 'tramadol', 'fentanyl', 'hydromorphone'],
        
        # Anticoagulants
        'anticoagulant': ['warfarin', 'rivaroxaban', 'apixaban', 'dabigatran', 'edoxaban', 'heparin', 'enoxaparin'],
        
        # Antiplatelets
        'antiplatelet': ['aspirin', 'clopidogrel', 'ticagrelor', 'prasugrel', 'dipyridamole'],
        
        # Antidiabetics
        'biguanide': ['metformin'],
        'sulfonylurea': ['glyburide', 'glipizide', 'glimepiride'],
        'dpp4_inhibitor': ['sitagliptin', 'saxagliptin', 'linagliptin'],
        
        # Antibiotics (same class)
        'fluoroquinolone': ['ciprofloxacin', 'levofloxacin', 'moxifloxacin'],
        'penicillin': ['amoxicillin', 'ampicillin', 'penicillin'],
        'macrolide': ['azithromycin', 'erythromycin', 'clarithromycin']
    }
    
    # Therapeutic duplications (same indication, different drugs)
    THERAPEUTIC_DUPLICATIONS = {
        'antihypertensive': ['ace_inhibitor', 'arb', 'beta_blocker', 'ccb', 'thiazide'],
        'anticoagulation': ['anticoagulant', 'antiplatelet'],
        'antidepressant': ['ssri', 'snri', 'tricyclic'],
        'diabetes_management': ['biguanide', 'sulfonylurea', 'dpp4_inhibitor', 'sglt2_inhibitor']
    }
    
    def detect_duplicates(
        self,
        medications: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Detect duplicate therapy
        
        Args:
            medications: List of medication dicts with 'name', 'genericName', 'drugClass', etc.
        
        Returns:
            duplicates: List of duplicate detections
            warnings: Therapeutic duplications
        """
        duplicates = []
        warnings = []
        same_class_duplicates = []
        
        if len(medications) < 2:
            return {
                'has_duplicates': False,
                'duplicates': [],
                'warnings': [],
                'summary': {'total_medications': len(medications)}
            }
        
        # Extract medication names and classes
        med_list = []
        for med in medications:
            name = med.get('genericName') or med.get('name') or str(med)
            drug_class = med.get('drugClass') or med.get('class')
            med_list.append({
                'name': name.lower(),
                'original_name': name,
                'drug_class': drug_class.lower() if drug_class else None,
                'full_info': med
            })
        
        # Check for exact duplicates (same medication name)
        seen_names = {}
        for i, med1 in enumerate(med_list):
            name_key = med1['name']
            if name_key in seen_names:
                duplicates.append({
                    'type': 'exact_duplicate',
                    'medication': med1['original_name'],
                    'duplicate_of': seen_names[name_key],
                    'severity': 'major',
                    'recommendation': f'Duplicate medication detected: {med1["original_name"]} - review for accidental duplicate prescription'
                })
            else:
                seen_names[name_key] = med1['original_name']
        
        # Check for same-class duplicates
        class_groups = {}
        for med in med_list:
            med_class = self._get_drug_class(med['name'], med['drug_class'])
            if med_class:
                if med_class not in class_groups:
                    class_groups[med_class] = []
                class_groups[med_class].append(med)
        
        for med_class, meds_in_class in class_groups.items():
            if len(meds_in_class) > 1:
                med_names = [m['original_name'] for m in meds_in_class]
                same_class_duplicates.append({
                    'type': 'same_class_duplicate',
                    'drug_class': med_class,
                    'medications': med_names,
                    'count': len(meds_in_class),
                    'severity': 'major',
                    'recommendation': f'Multiple {med_class.replace("_", " ")} medications detected ({", ".join(med_names)}) - consider if all are necessary'
                })
        
        # Check for therapeutic duplications
        therapeutic_groups = {}
        for med in med_list:
            med_class = self._get_drug_class(med['name'], med['drug_class'])
            for therapeutic, classes in self.THERAPEUTIC_DUPLICATIONS.items():
                if med_class in classes:
                    if therapeutic not in therapeutic_groups:
                        therapeutic_groups[therapeutic] = []
                    therapeutic_groups[therapeutic].append(med)
        
        for therapeutic, meds in therapeutic_groups.items():
            if len(meds) > 1:
                # Check if meds are from different classes (which might be intentional)
                med_classes = [self._get_drug_class(m['name'], m['drug_class']) for m in meds]
                unique_classes = set(med_classes)
                if len(unique_classes) == 1:
                    # Same class - this is a duplicate
                    warnings.append({
                        'type': 'therapeutic_duplication',
                        'indication': therapeutic.replace('_', ' '),
                        'medications': [m['original_name'] for m in meds],
                        'severity': 'moderate',
                        'recommendation': f'Multiple {therapeutic.replace("_", " ")} medications - verify if combination therapy is intentional and appropriate'
                    })
        
        # Combine results
        all_duplicates = duplicates + same_class_duplicates
        
        return {
            'has_duplicates': len(all_duplicates) > 0 or len(warnings) > 0,
            'duplicates': all_duplicates,
            'warnings': warnings,
            'summary': {
                'total_medications': len(medications),
                'exact_duplicates': len([d for d in duplicates if d['type'] == 'exact_duplicate']),
                'same_class_duplicates': len(same_class_duplicates),
                'therapeutic_warnings': len(warnings)
            }
        }
    
    def _get_drug_class(self, drug_name: str, provided_class: Optional[str] = None) -> Optional[str]:
        """Get drug class for a medication"""
        drug_lower = drug_name.lower()
        
        # Use provided class if available
        if provided_class:
            normalized_class = provided_class.lower().replace(' ', '_')
            return normalized_class
        
        # Lookup in drug classes
        for class_name, drugs in self.DRUG_CLASSES.items():
            if drug_lower in [d.lower() for d in drugs]:
                return class_name
            # Partial match
            for drug in drugs:
                if drug.lower() in drug_lower or drug_lower in drug.lower():
                    return class_name
        
        return None
    
    def check_overlapping_prescriptions(
        self,
        prescriptions: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Check for overlapping prescriptions of the same medication
        (different dates but overlapping periods)
        """
        overlaps = []
        
        # Group by medication name
        med_groups = {}
        for rx in prescriptions:
            med_name = (rx.get('genericName') or rx.get('medicationName') or rx.get('name', '')).lower()
            if not med_name:
                continue
            
            if med_name not in med_groups:
                med_groups[med_name] = []
            
            # Parse dates
            start_date = rx.get('startDate') or rx.get('date')
            end_date = rx.get('endDate') or rx.get('duration')
            
            med_groups[med_name].append({
                'prescription': rx,
                'start': self._parse_date(start_date),
                'end': self._parse_end_date(start_date, end_date)
            })
        
        # Check for overlaps within each medication group
        for med_name, rx_list in med_groups.items():
            if len(rx_list) < 2:
                continue
            
            # Sort by start date
            rx_list.sort(key=lambda x: x['start'] or datetime.min)
            
            for i in range(len(rx_list) - 1):
                rx1 = rx_list[i]
                rx2 = rx_list[i + 1]
                
                if rx1['start'] and rx2['start']:
                    # Check if prescriptions overlap
                    if rx1['end'] and rx2['start'] < rx1['end']:
                        overlaps.append({
                            'medication': med_name,
                            'prescription1': rx1['prescription'],
                            'prescription2': rx2['prescription'],
                            'overlap_period': f"{rx2['start']} to {rx1['end']}",
                            'severity': 'moderate',
                            'recommendation': f'Overlapping prescriptions for {med_name} - verify if patient needs both or if duplicate'
                        })
        
        return {
            'has_overlaps': len(overlaps) > 0,
            'overlaps': overlaps,
            'summary': {'total_overlaps': len(overlaps)}
        }
    
    def _parse_date(self, date_str: Any) -> Optional[datetime]:
        """Parse date string to datetime"""
        if not date_str:
            return None
        
        try:
            if isinstance(date_str, datetime):
                return date_str
            if isinstance(date_str, str):
                # Try ISO format
                if 'T' in date_str or '+' in date_str or date_str.endswith('Z'):
                    return datetime.fromisoformat(date_str.replace('Z', '+00:00'))
                # Try simple date
                return datetime.strptime(date_str, '%Y-%m-%d')
        except (ValueError, TypeError):
            return None
        
        return None
    
    def _parse_end_date(self, start_date: Any, duration: Any) -> Optional[datetime]:
        """Calculate end date from start and duration"""
        start = self._parse_date(start_date)
        if not start:
            return None
        
        # Parse duration (could be "30 days", "2 weeks", etc.)
        if duration:
            if isinstance(duration, (int, float)):
                # Assume days
                from datetime import timedelta
                return start + timedelta(days=int(duration))
            if isinstance(duration, str):
                # Try to parse "30 days", "2 weeks", etc.
                import re
                match = re.search(r'(\d+)\s*(day|week|month)', duration.lower())
                if match:
                    num = int(match.group(1))
                    unit = match.group(2)
                    from datetime import timedelta
                    if unit == 'day':
                        return start + timedelta(days=num)
                    elif unit == 'week':
                        return start + timedelta(weeks=num)
                    elif unit == 'month':
                        return start + timedelta(days=num * 30)
        
        # Default: assume 30 days if no duration specified
        from datetime import timedelta
        return start + timedelta(days=30)

