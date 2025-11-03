"""
High-Risk Medication Flags
Implements:
- Beers Criteria (elderly inappropriate medications)
- STOPP/START criteria
- High-alert medications
"""
from typing import List, Dict, Optional, Any


class HighRiskMedicationDetector:
    """Detects high-risk medications using evidence-based criteria"""
    
    # Beers Criteria - Medications to avoid in elderly (65+)
    BEERS_CRITERIA = {
        'strong_anticholinergics': {
            'medications': ['diphenhydramine', 'doxylamine', 'hydroxyzine', 'promethazine', 'benztropine', 'trihexyphenidyl'],
            'reason': 'Increased risk of cognitive impairment, falls, and anticholinergic toxicity',
            'severity': 'high',
            'alternatives': 'Consider non-pharmacologic options or safer alternatives'
        },
        'first_generation_antihistamines': {
            'medications': ['chlorpheniramine', 'brompheniramine', 'cyproheptadine'],
            'reason': 'Highly anticholinergic; clearance reduced with advanced age',
            'severity': 'high'
        },
        'benzodiazepines_long_acting': {
            'medications': ['diazepam', 'chlordiazepoxide', 'flurazepam', 'clorazepate'],
            'reason': 'Increased risk of cognitive impairment, delirium, falls, fractures, motor vehicle crashes',
            'severity': 'high',
            'alternatives': 'Avoid or use shorter-acting alternatives if necessary (lorazepam, oxazepam)'
        },
        'benzodiazepines_all': {
            'medications': ['alprazolam', 'lorazepam', 'temazepam', 'triazolam', 'oxazepam'],
            'reason': 'Avoid in patients with fall risk or cognitive impairment',
            'severity': 'moderate',
            'age_threshold': 65
        },
        'antipsychotics': {
            'medications': ['haloperidol', 'chlorpromazine', 'thioridazine', 'olanzapine', 'risperidone', 'quetiapine'],
            'reason': 'Increased risk of stroke and mortality in elderly with dementia',
            'severity': 'high',
            'condition': 'dementia'
        },
        'tricyclic_antidepressants': {
            'medications': ['amitriptyline', 'imipramine', 'doxepin', 'nortriptyline'],
            'reason': 'Highly anticholinergic and sedating; lower risk alternatives available',
            'severity': 'moderate',
            'alternatives': 'Consider SSRIs or SNRIs'
        },
        'meperidine': {
            'medications': ['meperidine'],
            'reason': 'Not effective oral analgesic; neurotoxic metabolite accumulates in renal impairment',
            'severity': 'high',
            'alternatives': 'Use morphine or hydromorphone instead'
        },
        'nonselctive_nsaids': {
            'medications': ['indomethacin', 'ketorolac', 'naproxen', 'piroxicam'],
            'reason': 'Increased risk of GI bleeding and peptic ulcer disease in elderly',
            'severity': 'moderate',
            'alternatives': 'Consider selective COX-2 inhibitors or topical NSAIDs'
        },
        'skeletal_muscle_relaxants': {
            'medications': ['cyclobenzaprine', 'carisoprodol', 'metaxalone', 'methocarbamol'],
            'reason': 'Most are poorly tolerated by elderly, cause anticholinergic effects',
            'severity': 'moderate',
            'alternatives': 'Consider non-pharmacologic options or topical therapies'
        },
        'digoxin_high_dose': {
            'medications': ['digoxin'],
            'reason': 'Dose >0.125 mg/day may provide little benefit with increased toxicity risk',
            'severity': 'moderate',
            'dose_limit': 0.125
        },
        'nitrofurantoin_long_term': {
            'medications': ['nitrofurantoin'],
            'reason': 'Potential for pulmonary toxicity and hepatotoxicity with long-term use',
            'severity': 'moderate',
            'duration_warning': 'Avoid if CrCl <30 mL/min'
        },
        'sulfonylureas_long_acting': {
            'medications': ['chlorpropamide', 'glyburide'],
            'reason': 'Prolonged half-life can cause prolonged hypoglycemia',
            'severity': 'high',
            'alternatives': 'Use shorter-acting sulfonylureas (glipizide, glimepiride)'
        },
        'alpha_blockers_non_htn': {
            'medications': ['doxazosin', 'prazosin', 'terazosin'],
            'reason': 'High risk of orthostatic hypotension; not recommended for hypertension',
            'severity': 'moderate',
            'condition_warning': 'Use only for BPH if needed'
        }
    }
    
    # STOPP (Screening Tool of Older Persons' Prescriptions) Criteria
    STOPP_CRITERIA = {
        'duplicate_drug_class': {
            'reason': 'Duplicate drug classes (e.g., two ACE inhibitors, two NSAIDs)',
            'severity': 'high'
        },
        'opioid_without_laxative': {
            'medications': ['morphine', 'oxycodone', 'codeine', 'tramadol'],
            'reason': 'Opioid prescribed without concurrent laxative - constipation risk',
            'severity': 'moderate',
            'recommendation': 'Prescribe laxative with opioid'
        },
        'aspirin_no_indication': {
            'medications': ['aspirin'],
            'reason': 'Aspirin without clear cardiovascular or cerebrovascular indication',
            'severity': 'moderate',
            'age_threshold': 70
        },
        'ppi_long_term_no_indication': {
            'medications': ['omeprazole', 'pantoprazole', 'lansoprazole', 'esomeprazole'],
            'reason': 'PPI >8 weeks without appropriate indication',
            'severity': 'moderate',
            'duration_warning': 56  # days
        },
        'anticholinergic_with_cognitive_impairment': {
            'medications': ['diphenhydramine', 'promethazine', 'scopolamine', 'atropine'],
            'reason': 'Anticholinergic with cognitive impairment - worsens cognitive function',
            'severity': 'high',
            'condition': 'dementia'
        }
    }
    
    # High-Alert Medications (ISMP - Institute for Safe Medication Practices)
    HIGH_ALERT_MEDICATIONS = {
        'insulin': {
            'severity': 'critical',
            'reason': 'High risk for severe hypoglycemia if dosing errors occur',
            'safety_tips': ['Double-check dose calculations', 'Use standardized insulin protocols', 'Monitor glucose closely']
        },
        'warfarin': {
            'severity': 'critical',
            'reason': 'Narrow therapeutic window, high bleeding risk',
            'safety_tips': ['Monitor INR regularly', 'Check for drug interactions', 'Educate on dietary considerations']
        },
        'opioids_iv': {
            'medications': ['morphine', 'fentanyl', 'hydromorphone'],
            'severity': 'critical',
            'reason': 'Risk of respiratory depression, especially in opioid-naive patients',
            'safety_tips': ['Start with low doses', 'Monitor respiratory rate', 'Have naloxone available']
        },
        'heparin': {
            'severity': 'critical',
            'reason': 'High bleeding risk, requires careful dosing',
            'safety_tips': ['Verify indication', 'Check for heparin-induced thrombocytopenia history', 'Monitor PTT/anti-Xa']
        },
        'epinephrine': {
            'severity': 'critical',
            'reason': 'Can cause severe hypertension and arrhythmias if dosed incorrectly',
            'safety_tips': ['Verify concentration', 'Use weight-based dosing', 'Monitor vital signs closely']
        },
        'digoxin': {
            'severity': 'high',
            'reason': 'Narrow therapeutic window, risk of toxicity',
            'safety_tips': ['Monitor serum levels', 'Check renal function', 'Watch for signs of toxicity']
        },
        'chemotherapy': {
            'medications': ['methotrexate', 'cyclophosphamide', 'doxorubicin'],
            'severity': 'critical',
            'reason': 'High toxicity potential, requires specialized monitoring',
            'safety_tips': ['Verify indication and dosing', 'Monitor labs closely', 'Ensure patient education']
        }
    }
    
    def check_high_risk_medications(
        self,
        medications: List[Dict[str, Any]],
        patient_age: Optional[int] = None,
        patient_gender: Optional[str] = None,
        diagnoses: Optional[List[str]] = None,
        renal_function: Optional[float] = None  # eGFR or CrCl
    ) -> Dict[str, Any]:
        """
        Check medications against Beers, STOPP, and high-alert criteria
        
        Args:
            medications: List of medication dicts
            patient_age: Patient age
            patient_gender: Patient gender
            diagnoses: List of diagnoses
            renal_function: eGFR or CrCl (mL/min)
        """
        beers_alerts = []
        stopp_alerts = []
        high_alert_flags = []
        
        diagnoses_lower = [d.lower() for d in (diagnoses or [])]
        is_elderly = patient_age and patient_age >= 65
        
        for med_dict in medications:
            med_name = (med_dict.get('genericName') or med_dict.get('name') or str(med_dict)).lower()
            med_dose = med_dict.get('dose') or med_dict.get('dosage')
            
            # Check Beers Criteria (elderly)
            if is_elderly:
                beers_result = self._check_beers_criteria(med_name, med_dose, diagnoses_lower, renal_function)
                if beers_result:
                    beers_alerts.append(beers_result)
            
            # Check STOPP Criteria
            stopp_result = self._check_stopp_criteria(med_name, med_dose, diagnoses_lower, patient_age)
            if stopp_result:
                stopp_alerts.append(stopp_result)
            
            # Check High-Alert Medications
            high_alert_result = self._check_high_alert(med_name, med_dict)
            if high_alert_result:
                high_alert_flags.append(high_alert_result)
        
        return {
            'has_high_risk_medications': len(beers_alerts) > 0 or len(stopp_alerts) > 0 or len(high_alert_flags) > 0,
            'beers_criteria_alerts': beers_alerts,
            'stopp_criteria_alerts': stopp_alerts,
            'high_alert_medications': high_alert_flags,
            'summary': {
                'total_medications': len(medications),
                'beers_violations': len(beers_alerts),
                'stopp_violations': len(stopp_alerts),
                'high_alert_count': len(high_alert_flags)
            },
            'recommendations': self._generate_high_risk_recommendations(beers_alerts, stopp_alerts, high_alert_flags)
        }
    
    def _check_beers_criteria(
        self,
        med_name: str,
        med_dose: Any,
        diagnoses: List[str],
        renal_function: Optional[float]
    ) -> Optional[Dict[str, Any]]:
        """Check against Beers Criteria"""
        for criteria_name, criteria in self.BEERS_CRITERIA.items():
            if med_name in [m.lower() for m in criteria['medications']]:
                # Check condition-specific criteria
                if 'condition' in criteria:
                    condition = criteria.get('condition', '').lower()
                    if condition not in diagnoses:
                        continue  # Only flag if patient has the condition
                
                # Check dose limits
                if 'dose_limit' in criteria and med_dose:
                    try:
                        dose_val = float(str(med_dose).replace('mg', '').strip())
                        if dose_val <= criteria['dose_limit']:
                            continue  # Within safe dose
                    except (ValueError, TypeError):
                        pass
                
                # Check renal function warnings
                if 'duration_warning' in criteria and renal_function:
                    if 'CrCl' in str(criteria['duration_warning']) and renal_function < 30:
                        return {
                            'medication': med_name,
                            'criteria': criteria_name,
                            'severity': criteria['severity'],
                            'reason': criteria['reason'],
                            'recommendation': criteria.get('alternatives', 'Review medication necessity'),
                            'beers_category': 'avoid_in_elderly'
                        }
                
                return {
                    'medication': med_name,
                    'criteria': criteria_name,
                    'severity': criteria['severity'],
                    'reason': criteria['reason'],
                    'recommendation': criteria.get('alternatives', 'Consider alternative medication or non-pharmacologic options'),
                    'beers_category': 'avoid_in_elderly'
                }
        
        return None
    
    def _check_stopp_criteria(
        self,
        med_name: str,
        med_dose: Any,
        diagnoses: List[str],
        patient_age: Optional[int]
    ) -> Optional[Dict[str, Any]]:
        """Check against STOPP Criteria"""
        for criteria_name, criteria in self.STOPP_CRITERIA.items():
            if 'medications' in criteria:
                if med_name not in [m.lower() for m in criteria['medications']]:
                    continue
            
            # Check age threshold
            if 'age_threshold' in criteria and patient_age:
                if patient_age < criteria['age_threshold']:
                    continue
            
            # Check condition-specific
            if 'condition' in criteria:
                condition = criteria['condition'].lower()
                if condition not in diagnoses:
                    continue
            
            return {
                'medication': med_name,
                'criteria': criteria_name,
                'severity': criteria.get('severity', 'moderate'),
                'reason': criteria['reason'],
                'recommendation': criteria.get('recommendation', 'Review medication indication and necessity'),
                'stopp_category': 'potentially_inappropriate'
            }
        
        return None
    
    def _check_high_alert(self, med_name: str, med_dict: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Check if medication is high-alert"""
        for alert_name, alert_info in self.HIGH_ALERT_MEDICATIONS.items():
            if 'medications' in alert_info:
                if med_name in [m.lower() for m in alert_info['medications']]:
                    return {
                        'medication': med_name,
                        'alert_type': alert_name,
                        'severity': alert_info['severity'],
                        'reason': alert_info['reason'],
                        'safety_tips': alert_info.get('safety_tips', []),
                        'category': 'high_alert'
                    }
            elif med_name.startswith(alert_name.lower()):
                return {
                    'medication': med_name,
                    'alert_type': alert_name,
                    'severity': alert_info['severity'],
                    'reason': alert_info['reason'],
                    'safety_tips': alert_info.get('safety_tips', []),
                    'category': 'high_alert'
                }
        
        return None
    
    def _generate_high_risk_recommendations(
        self,
        beers_alerts: List[Dict[str, Any]],
        stopp_alerts: List[Dict[str, Any]],
        high_alert_flags: List[Dict[str, Any]]
    ) -> List[str]:
        """Generate recommendations based on high-risk medication findings"""
        recommendations = []
        
        if beers_alerts:
            recommendations.append(f'{len(beers_alerts)} medication(s) may be inappropriate for elderly patient - review Beers Criteria violations')
        
        if stopp_alerts:
            recommendations.append(f'{len(stopp_alerts)} potentially inappropriate prescription(s) detected - review STOPP criteria')
        
        if high_alert_flags:
            critical_alerts = [a for a in high_alert_flags if a['severity'] == 'critical']
            if critical_alerts:
                recommendations.append(f'CRITICAL: {len(critical_alerts)} high-alert medication(s) detected - implement extra safety measures')
            
            recommendations.append('High-alert medications require: double-checking, careful monitoring, and patient education')
        
        if not recommendations:
            recommendations.append('No high-risk medication issues detected')
        
        return recommendations

