"""
Advanced Drug-Drug Interaction Checking Module
Implements pharmacokinetic and pharmacodynamic interaction analysis
"""
from typing import List, Dict, Any, Optional
import re


class DrugInteractionAnalyzer:
    """Advanced drug interaction analyzer using pharmacokinetic and pharmacodynamic principles"""
    
    # CYP450 Enzyme Substrates, Inhibitors, Inducers
    CYP_ENZYMES = {
        'CYP1A2': {
            'substrates': ['warfarin', 'theophylline', 'clozapine', 'caffeine', 'tacrine'],
            'inhibitors': ['fluvoxamine', 'ciprofloxacin', 'erythromycin'],
            'inducers': ['smoking', 'omeprazole', 'phenobarbital']
        },
        'CYP2C9': {
            'substrates': ['warfarin', 'phenytoin', 'losartan', 'tolbutamide'],
            'inhibitors': ['fluconazole', 'amiodarone', 'sulfaphenazole'],
            'inducers': ['rifampin', 'carbamazepine', 'phenobarbital']
        },
        'CYP2C19': {
            'substrates': ['omeprazole', 's-mephenytoin', 'diazepam'],
            'inhibitors': ['omeprazole', 'fluoxetine', 'fluvoxamine'],
            'inducers': ['rifampin', 'prednisone']
        },
        'CYP2D6': {
            'substrates': ['metoprolol', 'propranolol', 'codeine', 'dextromethorphan'],
            'inhibitors': ['paroxetine', 'fluoxetine', 'quinidine', 'cimetidine'],
            'inducers': ['rifampin']
        },
        'CYP3A4': {
            'substrates': ['warfarin', 'cyclosporine', 'simvastatin', 'atorvastatin', 'digoxin'],
            'inhibitors': ['ketoconazole', 'itraconazole', 'erythromycin', 'clarithromycin', 'ritonavir'],
            'inducers': ['rifampin', 'carbamazepine', 'phenytoin', 'phenobarbital', 'st_johns_wort']
        }
    }
    
    # Known critical drug interactions (supplementing database)
    CRITICAL_INTERACTIONS = {
        ('warfarin', 'aspirin'): {
            'severity': 'major',
            'mechanism': 'Increased bleeding risk due to synergistic anticoagulant effects',
            'clinical_significance': 9.5,
            'management': 'Monitor INR closely, consider reduced warfarin dose, assess bleeding risk'
        },
        ('warfarin', 'digoxin'): {
            'severity': 'moderate',
            'mechanism': 'Digoxin may enhance anticoagulant effect, potential for bleeding',
            'clinical_significance': 7.0,
            'management': 'Monitor INR and digoxin levels, adjust doses as needed'
        },
        ('digoxin', 'furosemide'): {
            'severity': 'moderate',
            'mechanism': 'Furosemide causes hypokalemia which increases digoxin toxicity risk',
            'clinical_significance': 8.0,
            'management': 'Monitor potassium levels, maintain K+ > 4.0 mEq/L, monitor digoxin levels'
        },
        ('metformin', 'furosemide'): {
            'severity': 'minor',
            'mechanism': 'Both can affect electrolytes, potential for lactic acidosis with metformin',
            'clinical_significance': 5.0,
            'management': 'Monitor renal function and electrolytes, especially in elderly'
        }
    }
    
    # Pharmacodynamic interactions (receptor-based)
    PHARMACODYNAMIC_INTERACTIONS = {
        ('beta_blocker', 'calcium_channel_blocker'): {
            'severity': 'moderate',
            'mechanism': 'Additive effects on heart rate and cardiac contractility',
            'risk': 'Bradycardia, heart block, hypotension'
        },
        ('ace_inhibitor', 'potassium_sparing_diuretic'): {
            'severity': 'moderate',
            'mechanism': 'Both increase serum potassium',
            'risk': 'Hyperkalemia'
        },
        ('nsaid', 'ace_inhibitor'): {
            'severity': 'moderate',
            'mechanism': 'NSAIDs reduce ACE inhibitor effectiveness, increase renal toxicity',
            'risk': 'Renal impairment, elevated BP'
        }
    }
    
    def normalize_drug_name(self, drug_name: str) -> str:
        """Normalize drug name for matching"""
        return drug_name.lower().strip()
    
    def check_cyp450_interactions(self, drug1_name: str, drug2_name: str) -> Optional[Dict[str, Any]]:
        """Check for CYP450 enzyme-based interactions"""
        drug1_lower = self.normalize_drug_name(drug1_name)
        drug2_lower = self.normalize_drug_name(drug2_name)
        
        interactions_found = []
        
        for enzyme, data in self.CYP_ENZYMES.items():
            # Check if drug1 is a substrate and drug2 is an inhibitor/inducer
            if drug1_lower in data['substrates']:
                if drug2_lower in data['inhibitors']:
                    interactions_found.append({
                        'enzyme': enzyme,
                        'type': 'inhibition',
                        'drug1_role': 'substrate',
                        'drug2_role': 'inhibitor',
                        'effect': f'{drug2_name} inhibits {enzyme} metabolism of {drug1_name}',
                        'severity': 'major',
                        'clinical_impact': 'Increased drug1 levels, risk of toxicity',
                        'management': f'Monitor {drug1_name} levels, consider dose reduction'
                    })
                elif drug2_lower in data['inducers']:
                    interactions_found.append({
                        'enzyme': enzyme,
                        'type': 'induction',
                        'drug1_role': 'substrate',
                        'drug2_role': 'inducer',
                        'effect': f'{drug2_name} induces {enzyme} metabolism of {drug1_name}',
                        'severity': 'moderate',
                        'clinical_impact': 'Decreased drug1 levels, potential therapeutic failure',
                        'management': f'Monitor {drug1_name} levels, may need dose increase'
                    })
            
            # Check reverse (drug2 substrate, drug1 inhibitor/inducer)
            if drug2_lower in data['substrates']:
                if drug1_lower in data['inhibitors']:
                    interactions_found.append({
                        'enzyme': enzyme,
                        'type': 'inhibition',
                        'drug1_role': 'inhibitor',
                        'drug2_role': 'substrate',
                        'effect': f'{drug1_name} inhibits {enzyme} metabolism of {drug2_name}',
                        'severity': 'major',
                        'clinical_impact': 'Increased drug2 levels, risk of toxicity',
                        'management': f'Monitor {drug2_name} levels, consider dose reduction'
                    })
                elif drug1_lower in data['inducers']:
                    interactions_found.append({
                        'enzyme': enzyme,
                        'type': 'induction',
                        'drug1_role': 'inducer',
                        'drug2_role': 'substrate',
                        'effect': f'{drug1_name} induces {enzyme} metabolism of {drug2_name}',
                        'severity': 'moderate',
                        'clinical_impact': 'Decreased drug2 levels, potential therapeutic failure',
                        'management': f'Monitor {drug2_name} levels, may need dose increase'
                    })
        
        if interactions_found:
            # Return the most severe interaction
            return max(interactions_found, key=lambda x: 1 if x['severity'] == 'major' else 0.5)
        return None
    
    def check_known_interactions(self, drug1_name: str, drug2_name: str) -> Optional[Dict[str, Any]]:
        """Check against known critical interactions database"""
        drug1_lower = self.normalize_drug_name(drug1_name)
        drug2_lower = self.normalize_drug_name(drug2_name)
        
        # Check both orders
        key1 = (drug1_lower, drug2_lower)
        key2 = (drug2_lower, drug1_lower)
        
        interaction = self.CRITICAL_INTERACTIONS.get(key1) or self.CRITICAL_INTERACTIONS.get(key2)
        if interaction:
            return {
                'mechanism': interaction['mechanism'],
                'severity': interaction['severity'],
                'clinical_significance': interaction['clinical_significance'],
                'management': interaction['management']
            }
        return None
    
    def classify_drug_class(self, drug_name: str, drug_class: Optional[str] = None) -> List[str]:
        """Classify drug into pharmacodynamic classes"""
        drug_lower = self.normalize_drug_name(drug_name)
        classes = []
        
        if drug_class:
            classes.append(drug_class.lower())
        
        # Infer from name/class
        beta_blockers = ['metoprolol', 'propranolol', 'atenolol', 'bisoprolol', 'carvedilol']
        ace_inhibitors = ['lisinopril', 'enalapril', 'captopril', 'ramipril']
        calcium_blockers = ['amlodipine', 'verapamil', 'diltiazem', 'nifedipine']
        nsaids = ['aspirin', 'ibuprofen', 'naproxen', 'diclofenac', 'indomethacin']
        potassium_diuretics = ['spironolactone', 'amiloride', 'triamterene']
        
        if any(bb in drug_lower for bb in beta_blockers):
            classes.append('beta_blocker')
        if any(ace in drug_lower for ace in ace_inhibitors):
            classes.append('ace_inhibitor')
        if any(cb in drug_lower for cb in calcium_blockers):
            classes.append('calcium_channel_blocker')
        if any(nsaid in drug_lower for nsaid in nsaids):
            classes.append('nsaid')
        if any(pd in drug_lower for pd in potassium_diuretics):
            classes.append('potassium_sparing_diuretic')
        
        return classes
    
    def check_pharmacodynamic_interactions(self, drug1_name: str, drug1_class: Optional[str], 
                                          drug2_name: str, drug2_class: Optional[str]) -> Optional[Dict[str, Any]]:
        """Check for pharmacodynamic (receptor-based) interactions"""
        classes1 = self.classify_drug_class(drug1_name, drug1_class)
        classes2 = self.classify_drug_class(drug2_name, drug2_class)
        
        # Check all combinations
        for class1 in classes1:
            for class2 in classes2:
                key1 = (class1, class2)
                key2 = (class2, class1)
                
                interaction = (self.PHARMACODYNAMIC_INTERACTIONS.get(key1) or 
                              self.PHARMACODYNAMIC_INTERACTIONS.get(key2))
                if interaction:
                    return {
                        'type': 'pharmacodynamic',
                        'mechanism': interaction['mechanism'],
                        'severity': interaction['severity'],
                        'risk': interaction['risk'],
                        'classes': (class1, class2)
                    }
        return None
    
    def analyze_interactions(self, drug_pairs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Comprehensive interaction analysis
        
        Args:
            drug_pairs: List of dicts with 'drug1' and 'drug2' info
                Each dict should have: name, and optionally: id, drugClass
        """
        all_interactions = []
        
        for pair in drug_pairs:
            drug1 = pair.get('drug1', {})
            drug2 = pair.get('drug2', {})
            
            drug1_name = drug1.get('genericName') or drug1.get('name', '')
            drug2_name = drug2.get('genericName') or drug2.get('name', '')
            drug1_class = drug1.get('drugClass')
            drug2_class = drug2.get('drugClass')
            
            if not drug1_name or not drug2_name:
                continue
            
            interactions_found = []
            
            # 1. Check known critical interactions (highest priority)
            known_interaction = self.check_known_interactions(drug1_name, drug2_name)
            if known_interaction:
                interactions_found.append({
                    **known_interaction,
                    'type': 'known_critical',
                    'drug1': drug1_name,
                    'drug2': drug2_name,
                    'source': 'interaction_database'
                })
            
            # 2. Check CYP450 interactions
            cyp_interaction = self.check_cyp450_interactions(drug1_name, drug2_name)
            if cyp_interaction:
                interactions_found.append({
                    **cyp_interaction,
                    'drug1': drug1_name,
                    'drug2': drug2_name,
                    'source': 'cyp450_analysis'
                })
            
            # 3. Check pharmacodynamic interactions
            pd_interaction = self.check_pharmacodynamic_interactions(
                drug1_name, drug1_class, drug2_name, drug2_class
            )
            if pd_interaction:
                interactions_found.append({
                    **pd_interaction,
                    'drug1': drug1_name,
                    'drug2': drug2_name,
                    'source': 'pharmacodynamic_analysis'
                })
            
            # Add to results
            if interactions_found:
                # Prioritize by severity: major > moderate > minor
                severity_order = {'major': 3, 'moderate': 2, 'minor': 1}
                primary_interaction = max(interactions_found, 
                    key=lambda x: severity_order.get(x.get('severity', 'minor'), 0))
                all_interactions.append(primary_interaction)
        
        return all_interactions

