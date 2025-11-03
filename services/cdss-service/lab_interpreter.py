"""
Lab Result Interpreter
Analyzes laboratory results for:
- Abnormal values (critical, high, low)
- Trend analysis
- Critical alerts
- Reference range checking
"""
from typing import Dict, List, Optional, Any
from datetime import datetime
import statistics


class LabResultInterpreter:
    """Interprets laboratory results and provides clinical alerts"""
    
    # Reference ranges (adult, may vary by lab)
    REFERENCE_RANGES = {
        'creatinine': {'min': 0.6, 'max': 1.2, 'unit': 'mg/dL', 'critical_low': 0.3, 'critical_high': 3.0},
        'egfr': {'min': 90, 'max': 120, 'unit': 'mL/min/1.73m²', 'critical_low': 15, 'critical_high': 150},
        'hemoglobin': {'min': 12.0, 'max': 16.0, 'unit': 'g/dL', 'critical_low': 7.0, 'critical_high': 20.0},
        'hematocrit': {'min': 36, 'max': 48, 'unit': '%', 'critical_low': 21, 'critical_high': 60},
        'white_blood_cell_count': {'min': 4.5, 'max': 11.0, 'unit': '×10³/μL', 'critical_low': 2.0, 'critical_high': 30.0},
        'platelet_count': {'min': 150, 'max': 450, 'unit': '×10³/μL', 'critical_low': 50, 'critical_high': 1000},
        'sodium': {'min': 136, 'max': 145, 'unit': 'mEq/L', 'critical_low': 120, 'critical_high': 160},
        'potassium': {'min': 3.5, 'max': 5.0, 'unit': 'mEq/L', 'critical_low': 2.5, 'critical_high': 6.5},
        'glucose': {'min': 70, 'max': 100, 'unit': 'mg/dL', 'critical_low': 40, 'critical_high': 400},
        'hba1c': {'min': 4.0, 'max': 5.7, 'unit': '%', 'critical_low': None, 'critical_high': 14.0},
        'total_cholesterol': {'min': 0, 'max': 200, 'unit': 'mg/dL', 'critical_low': None, 'critical_high': 300},
        'ldl_cholesterol': {'min': 0, 'max': 100, 'unit': 'mg/dL', 'critical_low': None, 'critical_high': 190},
        'hdl_cholesterol': {'min': 40, 'max': 60, 'unit': 'mg/dL', 'critical_low': 20, 'critical_high': 100},
        'triglycerides': {'min': 0, 'max': 150, 'unit': 'mg/dL', 'critical_low': None, 'critical_high': 500},
        'alt': {'min': 7, 'max': 56, 'unit': 'U/L', 'critical_low': None, 'critical_high': 300},
        'ast': {'min': 10, 'max': 40, 'unit': 'U/L', 'critical_low': None, 'critical_high': 200},
        'bilirubin_total': {'min': 0.2, 'max': 1.2, 'unit': 'mg/dL', 'critical_low': None, 'critical_high': 5.0},
        'troponin': {'min': 0, 'max': 0.04, 'unit': 'ng/mL', 'critical_low': None, 'critical_high': 0.1},
        'nt_probnp': {'min': 0, 'max': 125, 'unit': 'pg/mL', 'critical_low': None, 'critical_high': 450},
        'bun': {'min': 7, 'max': 20, 'unit': 'mg/dL', 'critical_low': 5, 'critical_high': 50},
        'calcium': {'min': 8.5, 'max': 10.5, 'unit': 'mg/dL', 'critical_low': 7.0, 'critical_high': 12.0},
        'phosphorus': {'min': 2.5, 'max': 4.5, 'unit': 'mg/dL', 'critical_low': 1.5, 'critical_high': 7.0},
        'magnesium': {'min': 1.7, 'max': 2.2, 'unit': 'mg/dL', 'critical_low': 1.0, 'critical_high': 3.0},
        'tsh': {'min': 0.4, 'max': 4.0, 'unit': 'mIU/L', 'critical_low': 0.1, 'critical_high': 10.0},
        'inr': {'min': 0.9, 'max': 1.1, 'unit': 'ratio', 'critical_low': 0.5, 'critical_high': 5.0},
        'pt': {'min': 11, 'max': 13.5, 'unit': 'seconds', 'critical_low': 8, 'critical_high': 25},
        'aptt': {'min': 25, 'max': 35, 'unit': 'seconds', 'critical_low': 20, 'critical_high': 60}
    }
    
    def interpret_lab_result(
        self,
        test_name: str,
        value: float,
        unit: Optional[str] = None,
        reference_range: Optional[Dict[str, float]] = None
    ) -> Dict[str, Any]:
        """
        Interpret a single lab result
        
        Returns:
            - status: 'normal', 'high', 'low', 'critical_high', 'critical_low'
            - interpretation
            - alerts
        """
        # Normalize test name
        test_key = self._normalize_test_name(test_name)
        
        # Use provided reference range or lookup
        ref_range = reference_range or self.REFERENCE_RANGES.get(test_key)
        
        if not ref_range:
            return {
                'test_name': test_name,
                'value': value,
                'status': 'unknown',
                'interpretation': 'Reference range not available for this test',
                'alerts': []
            }
        
        min_val = ref_range.get('min')
        max_val = ref_range.get('max')
        critical_low = ref_range.get('critical_low')
        critical_high = ref_range.get('critical_high')
        
        status = 'normal'
        interpretation = ''
        alerts = []
        
        # Check critical values first
        if critical_high and value >= critical_high:
            status = 'critical_high'
            interpretation = f'CRITICAL: {test_name} is critically elevated'
            alerts.append({
                'level': 'critical',
                'message': f'{test_name} critically elevated ({value} {ref_range.get("unit", "")})',
                'action': 'Immediate clinical review required'
            })
        elif critical_low and value <= critical_low:
            status = 'critical_low'
            interpretation = f'CRITICAL: {test_name} is critically low'
            alerts.append({
                'level': 'critical',
                'message': f'{test_name} critically low ({value} {ref_range.get("unit", "")})',
                'action': 'Immediate clinical review required'
            })
        # Check high values
        elif max_val and value > max_val:
            status = 'high'
            interpretation = f'{test_name} is elevated above normal range'
            severity = 'major' if value > max_val * 1.5 else 'moderate'
            alerts.append({
                'level': severity,
                'message': f'{test_name} elevated: {value} {ref_range.get("unit", "")} (normal: {min_val}-{max_val})',
                'action': self._get_action_for_abnormal(test_key, 'high')
            })
        # Check low values
        elif min_val and value < min_val:
            status = 'low'
            interpretation = f'{test_name} is below normal range'
            severity = 'major' if value < min_val * 0.7 else 'moderate'
            alerts.append({
                'level': severity,
                'message': f'{test_name} low: {value} {ref_range.get("unit", "")} (normal: {min_val}-{max_val})',
                'action': self._get_action_for_abnormal(test_key, 'low')
            })
        else:
            status = 'normal'
            interpretation = f'{test_name} is within normal range'
        
        return {
            'test_name': test_name,
            'test_key': test_key,
            'value': value,
            'unit': unit or ref_range.get('unit', ''),
            'reference_range': {
                'min': min_val,
                'max': max_val,
                'unit': ref_range.get('unit', '')
            },
            'status': status,
            'interpretation': interpretation,
            'alerts': alerts
        }
    
    def analyze_lab_results(
        self,
        lab_results: Dict[str, Any],
        historical_labs: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """
        Analyze multiple lab results with trend analysis
        
        Args:
            lab_results: Current lab results {test_name: value}
            historical_labs: List of previous lab results with timestamps
        """
        interpretations = []
        critical_alerts = []
        warnings = []
        trends = {}
        
        # Interpret current results
        for test_name, value in lab_results.items():
            if value is None:
                continue
            
            try:
                numeric_value = float(value)
                interpretation = self.interpret_lab_result(test_name, numeric_value)
                interpretations.append(interpretation)
                
                # Collect alerts
                for alert in interpretation.get('alerts', []):
                    if alert['level'] == 'critical':
                        critical_alerts.append(alert)
                    else:
                        warnings.append(alert)
            except (ValueError, TypeError):
                continue
        
        # Trend analysis if historical data available
        if historical_labs and len(historical_labs) > 0:
            trends = self._analyze_lab_trends(lab_results, historical_labs)
        
        return {
            'interpretations': interpretations,
            'summary': {
                'total_tests': len(interpretations),
                'normal': len([i for i in interpretations if i['status'] == 'normal']),
                'abnormal': len([i for i in interpretations if i['status'] != 'normal']),
                'critical': len(critical_alerts)
            },
            'critical_alerts': critical_alerts,
            'warnings': warnings,
            'trends': trends,
            'recommendations': self._generate_recommendations(interpretations, critical_alerts, warnings)
        }
    
    def _normalize_test_name(self, test_name: str) -> str:
        """Normalize test name to key"""
        normalized = test_name.lower().replace(' ', '_').replace('-', '_')
        
        # Common aliases
        aliases = {
            'creat': 'creatinine',
            'scr': 'creatinine',
            'hgb': 'hemoglobin',
            'hb': 'hemoglobin',
            'hct': 'hematocrit',
            'wbc': 'white_blood_cell_count',
            'plt': 'platelet_count',
            'na': 'sodium',
            'k': 'potassium',
            'gluc': 'glucose',
            'a1c': 'hba1c',
            'chol': 'total_cholesterol',
            'ldl': 'ldl_cholesterol',
            'hdl': 'hdl_cholesterol',
            'tg': 'triglycerides',
            'sgot': 'ast',
            'sgpt': 'alt',
            'tbil': 'bilirubin_total',
            'trop': 'troponin',
            'bnp': 'nt_probnp',
            'urea': 'bun',
            'ca': 'calcium',
            'po4': 'phosphorus',
            'mg': 'magnesium'
        }
        
        return aliases.get(normalized, normalized)
    
    def _get_action_for_abnormal(self, test_key: str, direction: str) -> str:
        """Get recommended action for abnormal lab value"""
        actions = {
            'creatinine': {
                'high': 'Assess renal function, review medications, consider nephrology consult if persistent',
                'low': 'Low muscle mass or malnutrition - consider nutritional assessment'
            },
            'egfr': {
                'low': 'Assess for CKD, review nephrotoxic medications, stage appropriately',
                'high': 'Consider assessment for hyperfiltration'
            },
            'potassium': {
                'high': 'Hyperkalemia - assess ECG, review medications (ACE/ARB, potassium-sparing diuretics), consider emergency intervention if severe',
                'low': 'Hypokalemia - assess for arrhythmias, consider supplementation'
            },
            'sodium': {
                'high': 'Hypernatremia - assess volume status, review fluid intake',
                'low': 'Hyponatremia - assess volume status, SIADH evaluation if appropriate'
            },
            'glucose': {
                'high': 'Hyperglycemia - assess for diabetes, review medications, consider HbA1c',
                'low': 'Hypoglycemia - assess symptoms, review antidiabetic medications, consider emergency treatment'
            },
            'inr': {
                'high': 'Elevated INR - assess bleeding risk, review warfarin dose, consider reversal if severe',
                'low': 'Subtherapeutic INR - may need warfarin dose adjustment'
            },
            'troponin': {
                'high': 'Elevated troponin - rule out acute MI, assess for other causes of cardiac injury'
            }
        }
        
        return actions.get(test_key, {}).get(direction, 'Review and follow-up as clinically indicated')
    
    def _analyze_lab_trends(
        self,
        current_labs: Dict[str, Any],
        historical_labs: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Analyze trends in lab values over time"""
        trends = {}
        
        for test_name, current_value in current_labs.items():
            if current_value is None:
                continue
            
            try:
                current = float(current_value)
                test_key = self._normalize_test_name(test_name)
                
                # Extract historical values for this test
                historical_values = []
                for lab_set in historical_labs:
                    if test_name in lab_set or test_key in lab_set:
                        value = lab_set.get(test_name) or lab_set.get(test_key)
                        if value:
                            try:
                                historical_values.append(float(value))
                            except (ValueError, TypeError):
                                pass
                
                if len(historical_values) >= 2:
                    recent_avg = statistics.mean(historical_values[-3:]) if len(historical_values) >= 3 else historical_values[-1]
                    older_avg = statistics.mean(historical_values[:-3]) if len(historical_values) >= 6 else historical_values[0]
                    
                    change = current - recent_avg
                    change_pct = (change / recent_avg * 100) if recent_avg > 0 else 0
                    
                    # Determine trend
                    if change_pct > 20:
                        trend = 'significantly_increasing'
                    elif change_pct > 10:
                        trend = 'increasing'
                    elif change_pct < -20:
                        trend = 'significantly_decreasing'
                    elif change_pct < -10:
                        trend = 'decreasing'
                    else:
                        trend = 'stable'
                    
                    trends[test_key] = {
                        'current': current,
                        'recent_average': round(recent_avg, 2),
                        'change': round(change, 2),
                        'change_percent': round(change_pct, 1),
                        'trend': trend,
                        'data_points': len(historical_values) + 1
                    }
            except (ValueError, TypeError):
                continue
        
        return trends
    
    def _generate_recommendations(
        self,
        interpretations: List[Dict[str, Any]],
        critical_alerts: List[Dict[str, Any]],
        warnings: List[Dict[str, Any]]
    ) -> List[str]:
        """Generate clinical recommendations based on lab results"""
        recommendations = []
        
        if critical_alerts:
            recommendations.append('IMMEDIATE ATTENTION REQUIRED: Critical lab values detected - urgent clinical review needed')
        
        # Check for common patterns
        critical_tests = [i for i in interpretations if i['status'].startswith('critical')]
        if critical_tests:
            test_names = [t['test_name'] for t in critical_tests]
            recommendations.append(f'Critical values in: {", ".join(test_names)} - consider immediate intervention')
        
        # Renal function
        creat_results = [i for i in interpretations if 'creatinine' in i.get('test_key', '')]
        if creat_results and creat_results[0]['status'] != 'normal':
            recommendations.append('Abnormal renal function - review medications for nephrotoxic drugs, consider dose adjustments')
        
        # Coagulation
        inr_results = [i for i in interpretations if 'inr' in i.get('test_key', '')]
        if inr_results and inr_results[0]['status'] != 'normal':
            recommendations.append('Abnormal INR - review anticoagulation therapy, assess bleeding/clotting risk')
        
        # Electrolytes
        electrolyte_tests = [i for i in interpretations if any(e in i.get('test_key', '') for e in ['sodium', 'potassium', 'calcium', 'magnesium'])]
        abnormal_electrolytes = [e for e in electrolyte_tests if e['status'] != 'normal']
        if abnormal_electrolytes:
            recommendations.append('Electrolyte abnormalities detected - assess for underlying causes and consider correction')
        
        # Diabetes markers
        glucose_results = [i for i in interpretations if 'glucose' in i.get('test_key', '')]
        hba1c_results = [i for i in interpretations if 'hba1c' in i.get('test_key', '')]
        if glucose_results and glucose_results[0]['status'] != 'normal':
            if not hba1c_results:
                recommendations.append('Abnormal glucose - consider HbA1c testing for diabetes screening/diagnosis')
        
        if warnings and len(warnings) > 3:
            recommendations.append(f'Multiple abnormal lab values ({len(warnings)}) - consider comprehensive review')
        
        if not recommendations:
            recommendations.append('Lab results reviewed - continue routine monitoring')
        
        return recommendations

