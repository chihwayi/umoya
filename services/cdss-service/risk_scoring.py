"""
Risk Scoring Algorithms
Cardiovascular risk, readmission risk, medication adherence risk calculations
"""
from typing import Dict, List, Optional, Any
import math


class RiskScoringEngine:
    """Patient risk scoring algorithms"""
    
    def calculate_framingham_risk(
        self,
        age: int,
        gender: str,
        total_cholesterol: float,
        hdl_cholesterol: float,
        systolic_bp: int,
        smoker: bool = False,
        diabetes: bool = False,
        on_bp_medication: bool = False
    ) -> Dict[str, Any]:
        """
        Framingham Risk Score for 10-year cardiovascular risk
        
        Returns:
            risk_score: 0-100%
            risk_level: low (<10%), moderate (10-20%), high (>20%)
            factors: Contributing risk factors
        """
        if not all([age, gender, total_cholesterol, hdl_cholesterol, systolic_bp]):
            return {
                'overall_score': 0.0,
                'risk_level': 'unknown',
                'factors': [{'factor': 'Incomplete data', 'impact': 'Cannot calculate Framingham risk'}],
                'recommendations': ['Complete lipid panel and blood pressure for risk assessment']
            }
        
        # Simplified Framingham calculation (full model is complex)
        # This is a simplified version - full implementation would use lookup tables
        risk_score = 0
        
        factors = []
        
        # Age factor
        if gender.lower() in ['male', 'm']:
            if age >= 55:
                risk_score += 5
                factors.append({'factor': f'Age {age} (male)', 'impact': 'moderate'})
        else:
            if age >= 65:
                risk_score += 5
                factors.append({'factor': f'Age {age} (female)', 'impact': 'moderate'})
        
        # Cholesterol
        cholesterol_ratio = total_cholesterol / hdl_cholesterol if hdl_cholesterol > 0 else 0
        if cholesterol_ratio > 6:
            risk_score += 4
            factors.append({'factor': f'High cholesterol ratio ({cholesterol_ratio:.1f})', 'impact': 'moderate'})
        elif cholesterol_ratio > 5:
            risk_score += 2
            factors.append({'factor': f'Elevated cholesterol ratio ({cholesterol_ratio:.1f})', 'impact': 'mild'})
        
        # Blood pressure
        if systolic_bp >= 140 or on_bp_medication:
            risk_score += 3
            factors.append({'factor': f'Hypertension (BP {systolic_bp})', 'impact': 'moderate'})
        elif systolic_bp >= 120:
            risk_score += 1
            factors.append({'factor': f'Elevated BP ({systolic_bp})', 'impact': 'mild'})
        
        # Smoking
        if smoker:
            risk_score += 4
            factors.append({'factor': 'Current smoker', 'impact': 'major'})
        
        # Diabetes
        if diabetes:
            risk_score += 5
            factors.append({'factor': 'Diabetes', 'impact': 'major'})
        
        # Determine risk level
        if risk_score >= 15:
            risk_level = 'high'
            recommendations = [
                'High cardiovascular risk - consider statin therapy',
                'Aggressive lifestyle modifications',
                'Consider aspirin if not contraindicated',
                'Monitor lipids annually'
            ]
        elif risk_score >= 10:
            risk_level = 'moderate'
            recommendations = [
                'Moderate cardiovascular risk',
                'Lifestyle modifications recommended',
                'Consider statin if LDL >100',
                'Monitor lipids every 2-3 years'
            ]
        else:
            risk_level = 'low'
            recommendations = [
                'Low cardiovascular risk',
                'Maintain healthy lifestyle',
                'Reassess risk in 5 years'
            ]
        
        # Convert to percentage (simplified)
        risk_percentage = min(risk_score * 2, 40)  # Cap at 40% for simplified model
        
        return {
            'overall_score': risk_percentage,
            'risk_level': risk_level,
            'factors': factors,
            'recommendations': recommendations,
            'model': 'Framingham Risk Score (simplified)'
        }
    
    def calculate_readmission_risk(
        self,
        age: int,
        number_of_medications: int,
        number_of_comorbidities: int,
        previous_admissions: int = 0,
        emergency_department_visits: int = 0
    ) -> Dict[str, Any]:
        """
        Hospital readmission risk calculator
        
        Returns:
            risk_score: 0-100%
            risk_level: low, moderate, high, critical
        """
        risk_score = 0
        factors = []
        
        # Age factor
        if age >= 75:
            risk_score += 20
            factors.append({'factor': 'Age ≥75', 'impact': 'moderate'})
        elif age >= 65:
            risk_score += 10
            factors.append({'factor': 'Age ≥65', 'impact': 'mild'})
        
        # Polypharmacy
        if number_of_medications >= 10:
            risk_score += 25
            factors.append({'factor': f'Polypharmacy ({number_of_medications} medications)', 'impact': 'major'})
        elif number_of_medications >= 5:
            risk_score += 10
            factors.append({'factor': f'Multiple medications ({number_of_medications})', 'impact': 'moderate'})
        
        # Comorbidities
        if number_of_comorbidities >= 5:
            risk_score += 20
            factors.append({'factor': f'Multiple comorbidities ({number_of_comorbidities})', 'impact': 'major'})
        elif number_of_comorbidities >= 3:
            risk_score += 10
            factors.append({'factor': f'Comorbidities ({number_of_comorbidities})', 'impact': 'moderate'})
        
        # Previous admissions
        if previous_admissions >= 3:
            risk_score += 30
            factors.append({'factor': f'History of frequent admissions ({previous_admissions})', 'impact': 'major'})
        elif previous_admissions >= 1:
            risk_score += 15
            factors.append({'factor': f'Previous admission ({previous_admissions})', 'impact': 'moderate'})
        
        # ED visits
        if emergency_department_visits >= 2:
            risk_score += 15
            factors.append({'factor': f'Frequent ED visits ({emergency_department_visits})', 'impact': 'moderate'})
        
        # Cap at 100
        risk_score = min(risk_score, 100)
        
        # Determine risk level
        if risk_score >= 60:
            risk_level = 'critical'
            recommendations = [
                'Very high readmission risk - intensive discharge planning needed',
                'Consider home health services',
                'Medication reconciliation essential',
                'Follow-up within 48 hours',
                'Patient education and caregiver support'
            ]
        elif risk_score >= 40:
            risk_level = 'high'
            recommendations = [
                'High readmission risk',
                'Ensure medication understanding',
                'Schedule follow-up within 7 days',
                'Coordinate with primary care'
            ]
        elif risk_score >= 20:
            risk_level = 'moderate'
            recommendations = [
                'Moderate readmission risk',
                'Standard discharge planning',
                'Follow-up within 14 days'
            ]
        else:
            risk_level = 'low'
            recommendations = [
                'Low readmission risk',
                'Standard discharge instructions',
                'Routine follow-up'
            ]
        
        return {
            'overall_score': risk_score,
            'risk_level': risk_level,
            'factors': factors,
            'recommendations': recommendations,
            'model': 'Readmission Risk Score'
        }
    
    def calculate_adherence_risk(
        self,
        number_of_medications: int,
        medication_frequency: List[str],  # e.g., ['once daily', 'twice daily', 'three times daily']
        patient_age: Optional[int] = None,
        cognitive_impairment: bool = False,
        cost_concerns: bool = False
    ) -> Dict[str, Any]:
        """
        Medication adherence risk assessment
        
        Returns:
            risk_score: 0-100%
            risk_level: low, moderate, high
        """
        risk_score = 0
        factors = []
        
        # Number of medications
        if number_of_medications >= 10:
            risk_score += 30
            factors.append({'factor': f'Complex regimen ({number_of_medications} medications)', 'impact': 'major'})
        elif number_of_medications >= 5:
            risk_score += 15
            factors.append({'factor': f'Multiple medications ({number_of_medications})', 'impact': 'moderate'})
        
        # Dosing frequency complexity
        complex_dosing = sum(1 for freq in medication_frequency if 'three times' in freq.lower() or 'four times' in freq.lower())
        if complex_dosing >= 2:
            risk_score += 20
            factors.append({'factor': f'Complex dosing schedule ({complex_dosing} TID/QID medications)', 'impact': 'moderate'})
        elif complex_dosing >= 1:
            risk_score += 10
            factors.append({'factor': 'Complex dosing schedule', 'impact': 'mild'})
        
        # Age
        if patient_age and patient_age >= 75:
            risk_score += 15
            factors.append({'factor': 'Advanced age', 'impact': 'moderate'})
        
        # Cognitive impairment
        if cognitive_impairment:
            risk_score += 25
            factors.append({'factor': 'Cognitive impairment', 'impact': 'major'})
        
        # Cost concerns
        if cost_concerns:
            risk_score += 20
            factors.append({'factor': 'Cost/accessibility concerns', 'impact': 'moderate'})
        
        risk_score = min(risk_score, 100)
        
        # Determine risk level
        if risk_score >= 50:
            risk_level = 'high'
            recommendations = [
                'High risk of medication non-adherence',
                'Simplify regimen if possible',
                'Consider medication synchronization',
                'Provide pill boxes or blister packs',
                'Involve caregiver/family',
                'Regular adherence monitoring'
            ]
        elif risk_score >= 30:
            risk_level = 'moderate'
            recommendations = [
                'Moderate adherence risk',
                'Simplify dosing schedule if possible',
                'Patient education on importance',
                'Use medication reminders'
            ]
        else:
            risk_level = 'low'
            recommendations = [
                'Low adherence risk',
                'Maintain current regimen',
                'Routine adherence checks'
            ]
        
        return {
            'overall_score': risk_score,
            'risk_level': risk_level,
            'factors': factors,
            'recommendations': recommendations,
            'model': 'Medication Adherence Risk'
        }

