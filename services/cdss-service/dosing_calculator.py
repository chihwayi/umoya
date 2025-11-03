"""
Dosing Calculator
Provides medication dosing recommendations based on patient factors:
- Renal function adjustments
- Weight-based dosing
- Age-based adjustments
- Hepatic function considerations
"""
from typing import Dict, List, Optional, Any
import math


class DosingCalculator:
    """Medication dosing calculator with pharmacokinetic adjustments"""
    
    # Common drug dosing database (simplified - in production would be comprehensive)
    DRUG_DOSING_DB = {
        'vancomycin': {
            'standard_dose': '15-20 mg/kg',
            'dosing_interval': 'q8-12h',
            'renal_adjustment': True,
            'weight_based': True,
            'monitoring': ['trough levels', 'creatinine']
        },
        'gentamicin': {
            'standard_dose': '5-7 mg/kg',
            'dosing_interval': 'q24h or q8h',
            'renal_adjustment': True,
            'weight_based': True,
            'monitoring': ['peak/trough levels', 'creatinine']
        },
        'digoxin': {
            'standard_dose': '0.125-0.25 mg',
            'dosing_interval': 'daily',
            'renal_adjustment': True,
            'weight_based': False,
            'monitoring': ['serum levels', 'eGFR']
        },
        'amikacin': {
            'standard_dose': '15-20 mg/kg',
            'dosing_interval': 'q8-12h',
            'renal_adjustment': True,
            'weight_based': True,
            'monitoring': ['trough levels']
        },
        'warfarin': {
            'standard_dose': '2-10 mg',
            'dosing_interval': 'daily',
            'renal_adjustment': False,
            'weight_based': False,
            'monitoring': ['INR']
        },
        'metformin': {
            'standard_dose': '500-1000 mg',
            'dosing_interval': 'BID or TID',
            'renal_adjustment': True,
            'contraindicated_eGFR': 30,
            'monitoring': ['eGFR', 'lactic acid']
        },
        'enalapril': {
            'standard_dose': '2.5-40 mg',
            'dosing_interval': 'BID',
            'renal_adjustment': True,
            'weight_based': False,
            'monitoring': ['creatinine', 'potassium']
        },
        'lisinopril': {
            'standard_dose': '5-40 mg',
            'dosing_interval': 'daily',
            'renal_adjustment': True,
            'weight_based': False,
            'monitoring': ['creatinine', 'potassium']
        },
        'furosemide': {
            'standard_dose': '20-80 mg',
            'dosing_interval': 'BID or TID',
            'renal_adjustment': True,
            'weight_based': False,
            'monitoring': ['electrolytes', 'renal function']
        }
    }
    
    def calculate_creatinine_clearance(
        self,
        age: int,
        gender: str,
        weight_kg: float,
        serum_creatinine: float
    ) -> float:
        """
        Calculate CrCl using Cockcroft-Gault equation
        
        CrCl (mL/min) = [(140 - age) × weight × gender_factor] / (72 × SCr)
        gender_factor: 1.0 for male, 0.85 for female
        """
        if serum_creatinine <= 0 or weight_kg <= 0:
            return 0.0
        
        gender_factor = 1.0 if gender.lower() in ['male', 'm'] else 0.85
        crcl = ((140 - age) * weight_kg * gender_factor) / (72 * serum_creatinine)
        
        # Cap at reasonable values
        return min(max(crcl, 0), 150)
    
    def adjust_for_renal_function(
        self,
        drug_name: str,
        standard_dose: float,
        eGFR: Optional[float] = None,
        crCl: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Adjust medication dose based on renal function
        
        Returns adjusted dose, interval, and warnings
        """
        drug_lower = drug_name.lower()
        drug_info = None
        
        # Find drug in database
        for drug_key, drug_data in self.DRUG_DOSING_DB.items():
            if drug_key in drug_lower or drug_lower in drug_key:
                drug_info = drug_data
                break
        
        if not drug_info or not drug_info.get('renal_adjustment'):
            return {
                'adjusted_dose': standard_dose,
                'adjusted_interval': 'unchanged',
                'adjustment_reason': 'No renal adjustment needed for this medication',
                'warnings': []
            }
        
        # Use eGFR if available, otherwise CrCl
        renal_function = eGFR if eGFR is not None else crCl
        
        if renal_function is None or renal_function <= 0:
            return {
                'adjusted_dose': standard_dose,
                'adjusted_interval': 'unchanged',
                'adjustment_reason': 'Renal function not available - cannot adjust',
                'warnings': ['Renal function unknown - monitor closely']
            }
        
        # Check for contraindications
        if drug_lower == 'metformin' and eGFR and eGFR < 30:
            return {
                'adjusted_dose': 0,
                'adjusted_interval': 'contraindicated',
                'adjustment_reason': 'Metformin contraindicated if eGFR < 30 mL/min/1.73m²',
                'warnings': ['DO NOT GIVE - Metformin contraindicated with severe renal impairment']
            }
        
        # Renal dosing adjustments based on CrCl/eGFR ranges
        adjustments = []
        warnings = []
        
        if renal_function >= 60:
            # Normal renal function - no adjustment
            adjusted_dose = standard_dose
            adjusted_interval = 'unchanged'
            adjustment_reason = 'Normal renal function - standard dosing'
        elif renal_function >= 30:
            # Mild to moderate impairment
            if drug_lower in ['gentamicin', 'amikacin', 'vancomycin']:
                # Extend interval for aminoglycosides
                adjusted_dose = standard_dose
                adjusted_interval = 'q24h' if standard_dose else 'extended interval'
                adjustment_reason = f'Renal function {renal_function:.1f} - extended interval dosing'
            else:
                # Reduce dose by 25-50%
                adjusted_dose = standard_dose * 0.75
                adjusted_interval = 'unchanged'
                adjustment_reason = f'Renal function {renal_function:.1f} - reduce dose by 25%'
            warnings.append('Monitor renal function closely')
        elif renal_function >= 15:
            # Moderate to severe impairment
            if drug_lower in ['gentamicin', 'amikacin', 'vancomycin']:
                adjusted_dose = standard_dose
                adjusted_interval = 'q48h'
                adjustment_reason = f'Renal function {renal_function:.1f} - extended interval (q48h)'
            else:
                adjusted_dose = standard_dose * 0.5
                adjusted_interval = 'unchanged'
                adjustment_reason = f'Renal function {renal_function:.1f} - reduce dose by 50%'
            warnings.append('Significant renal impairment - dose reduction required')
        else:
            # Severe impairment / dialysis
            if drug_lower in ['gentamicin', 'amikacin']:
                adjusted_dose = 0
                adjusted_interval = 'avoid'
                adjustment_reason = 'Severe renal impairment - consider alternative'
                warnings.append('Consider alternative antibiotic or dose after dialysis')
            else:
                adjusted_dose = standard_dose * 0.25
                adjusted_interval = 'unchanged'
                adjustment_reason = f'Severe renal impairment (eGFR {renal_function:.1f}) - reduce dose by 75%'
            warnings.append('Severe renal impairment - consult nephrology if needed')
        
        return {
            'adjusted_dose': round(adjusted_dose, 2) if adjusted_dose else 0,
            'adjusted_interval': adjusted_interval,
            'adjustment_reason': adjustment_reason,
            'warnings': warnings
        }
    
    def calculate_weight_based_dose(
        self,
        drug_name: str,
        weight_kg: float,
        dose_per_kg: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Calculate weight-based dosing
        """
        if weight_kg <= 0:
            return {
                'calculated_dose': 0,
                'dose_units': 'mg',
                'errors': ['Invalid weight provided']
            }
        
        drug_lower = drug_name.lower()
        
        # Default dosing per kg if not provided
        if not dose_per_kg:
            if 'vancomycin' in drug_lower:
                dose_per_kg = 15.0  # mg/kg
            elif 'gentamicin' in drug_lower:
                dose_per_kg = 6.0
            elif 'amikacin' in drug_lower:
                dose_per_kg = 15.0
            else:
                return {
                    'calculated_dose': 0,
                    'dose_units': 'mg',
                    'errors': ['No weight-based dosing information available for this drug']
                }
        
        calculated_dose = weight_kg * dose_per_kg
        
        # Round to practical dosing amounts
        if calculated_dose < 50:
            calculated_dose = round(calculated_dose, 1)
        elif calculated_dose < 500:
            calculated_dose = round(calculated_dose, 0)
        else:
            calculated_dose = round(calculated_dose / 50) * 50  # Round to nearest 50mg
        
        return {
            'calculated_dose': calculated_dose,
            'dose_per_kg': dose_per_kg,
            'dose_units': 'mg',
            'weight_kg': weight_kg
        }
    
    def adjust_for_age(
        self,
        age: int,
        standard_dose: float,
        drug_name: str = ''
    ) -> Dict[str, Any]:
        """
        Age-based dose adjustments (pediatric and geriatric)
        """
        adjustments = []
        warnings = []
        adjusted_dose = standard_dose
        
        # Pediatric dosing (age < 18)
        if age < 18:
            if age < 2:
                adjusted_dose = standard_dose * 0.25
                adjustments.append('Pediatric: <2 years - reduce to 25% of adult dose')
                warnings.append('Pediatric dosing - consult pediatric references')
            elif age < 6:
                adjusted_dose = standard_dose * 0.5
                adjustments.append('Pediatric: 2-6 years - reduce to 50% of adult dose')
            elif age < 12:
                adjusted_dose = standard_dose * 0.75
                adjustments.append('Pediatric: 6-12 years - reduce to 75% of adult dose')
            else:
                adjusted_dose = standard_dose
                adjustments.append('Pediatric: 12-18 years - may use adult dose with monitoring')
        
        # Geriatric dosing (age >= 65)
        elif age >= 65:
            # Start with lower doses in elderly
            adjusted_dose = standard_dose * 0.75
            adjustments.append(f'Geriatric (age {age}) - consider starting at 75% of standard dose')
            warnings.append('Start low, go slow - monitor for adverse effects')
        
        return {
            'adjusted_dose': round(adjusted_dose, 2),
            'adjustments': adjustments,
            'warnings': warnings
        }
    
    def recommend_dosing(
        self,
        drug_name: str,
        patient_age: int,
        patient_weight_kg: Optional[float] = None,
        patient_gender: Optional[str] = None,
        eGFR: Optional[float] = None,
        serum_creatinine: Optional[float] = None,
        crCl: Optional[float] = None,
        hepatic_function: Optional[str] = None,
        standard_dose: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Comprehensive dosing recommendation considering all factors
        
        Returns:
            recommended_dose: Final recommended dose
            frequency: Dosing frequency
            adjustments: List of adjustments made
            warnings: Clinical warnings
            monitoring: Required monitoring
        """
        drug_lower = drug_name.lower()
        drug_info = None
        
        # Find drug in database
        for drug_key, drug_data in self.DRUG_DOSING_DB.items():
            if drug_key in drug_lower or drug_lower in drug_key:
                drug_info = drug_data
                break
        
        # Get standard dose from database or use provided
        if not standard_dose:
            if drug_info:
                # Parse standard dose from database (e.g., "15-20 mg/kg")
                dose_str = drug_info.get('standard_dose', '')
                if 'mg/kg' in dose_str:
                    # Extract mg/kg value
                    try:
                        dose_range = dose_str.split('mg/kg')[0].strip()
                        if '-' in dose_range:
                            dose_min, dose_max = dose_range.split('-')
                            dose_per_kg = (float(dose_min) + float(dose_max)) / 2
                        else:
                            dose_per_kg = float(dose_range)
                        
                        if patient_weight_kg:
                            standard_dose = patient_weight_kg * dose_per_kg
                        else:
                            standard_dose = None
                    except:
                        standard_dose = None
        
        if not standard_dose:
            standard_dose = 0  # Default if cannot determine
        
        all_adjustments = []
        all_warnings = []
        final_dose = standard_dose
        dosing_interval = drug_info.get('dosing_interval', 'as directed') if drug_info else 'as directed'
        
        # 1. Weight-based dosing
        if drug_info and drug_info.get('weight_based') and patient_weight_kg:
            weight_dose = self.calculate_weight_based_dose(drug_name, patient_weight_kg)
            if weight_dose.get('calculated_dose'):
                final_dose = weight_dose['calculated_dose']
                all_adjustments.append(f"Weight-based: {weight_dose['calculated_dose']} mg ({weight_dose.get('dose_per_kg', 'N/A')} mg/kg)")
        
        # 2. Age-based adjustments
        if patient_age:
            age_adj = self.adjust_for_age(patient_age, final_dose, drug_name)
            if age_adj['adjusted_dose'] != final_dose:
                final_dose = age_adj['adjusted_dose']
                all_adjustments.extend(age_adj['adjustments'])
                all_warnings.extend(age_adj['warnings'])
        
        # 3. Calculate CrCl if not provided but we have the data
        if not crCl and not eGFR:
            if patient_age and patient_weight_kg and serum_creatinine:
                crCl = self.calculate_creatinine_clearance(
                    patient_age,
                    patient_gender or 'unknown',
                    patient_weight_kg,
                    serum_creatinine
                )
                all_adjustments.append(f"Calculated CrCl: {crCl:.1f} mL/min")
        
        # 4. Renal function adjustments
        if drug_info and drug_info.get('renal_adjustment'):
            if eGFR or crCl:
                renal_adj = self.adjust_for_renal_function(drug_name, final_dose, eGFR, crCl)
                if renal_adj['adjusted_dose'] != final_dose:
                    final_dose = renal_adj['adjusted_dose']
                    if renal_adj['adjusted_interval'] != 'unchanged':
                        dosing_interval = renal_adj['adjusted_interval']
                    all_adjustments.append(renal_adj['adjustment_reason'])
                    all_warnings.extend(renal_adj['warnings'])
        
        # 5. Hepatic function considerations
        if hepatic_function and hepatic_function.lower() in ['severe', 'cirrhosis', 'hepatic failure']:
            final_dose = final_dose * 0.5
            all_adjustments.append('Severe hepatic impairment - reduce dose by 50%')
            all_warnings.append('Monitor for hepatic toxicity')
        
        # Get monitoring requirements
        monitoring = drug_info.get('monitoring', []) if drug_info else []
        
        return {
            'recommended_dose': round(final_dose, 2) if final_dose else 0,
            'frequency': dosing_interval,
            'adjustments': all_adjustments,
            'warnings': list(set(all_warnings)),  # Remove duplicates
            'monitoring': monitoring,
            'drug_name': drug_name,
            'base_dose': standard_dose
        }

