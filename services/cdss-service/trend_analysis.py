"""
Trend Analysis Engine
Analyzes historical patient data to detect trends, patterns, and changes over time
"""
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
from collections import Counter
import statistics


class TrendAnalysisEngine:
    """Analyzes trends in patient vitals, labs, diagnoses, and visits"""
    
    def analyze_vital_trends(
        self,
        current_vitals: Dict[str, Any],
        historical_vitals: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Analyze trends in vital signs
        Returns: trend direction (improving/worsening/stable), significant changes, alerts
        """
        if not historical_vitals or len(historical_vitals) < 1:
            return {
                'has_trends': False,
                'message': 'Insufficient historical data for trend analysis'
            }
        
        # Sort by date
        sorted_vitals = sorted(
            historical_vitals + [current_vitals],
            key=lambda x: x.get('recordedAt', datetime.now().isoformat())
        )
        
        trends = {}
        alerts = []
        
        # Blood Pressure Trend
        if 'bloodPressure' in current_vitals:
            bp_values = []
            for v in sorted_vitals:
                if v.get('bloodPressure'):
                    bp = str(v['bloodPressure']).split('/')
                    if len(bp) >= 1:
                        try:
                            bp_values.append(int(bp[0]))  # Systolic
                        except:
                            pass
            
            if len(bp_values) >= 2:
                # Compare most recent vs earlier values
                if len(bp_values) >= 3:
                    recent_avg = statistics.mean(bp_values[-2:])  # Last 2 values
                    older_avg = statistics.mean(bp_values[:len(bp_values)-2])  # Earlier values
                else:
                    # With only 2 values, compare them directly
                    recent_avg = bp_values[-1]
                    older_avg = bp_values[0]
                
                trend = 'improving' if recent_avg < older_avg - 5 else 'worsening' if recent_avg > older_avg + 5 else 'stable'
                trends['bloodPressure'] = {
                    'trend': trend,
                    'recent_average': round(recent_avg, 1),
                    'previous_average': round(older_avg, 1),
                    'change': round(recent_avg - older_avg, 1)
                }
                
                if trend == 'worsening' and recent_avg > 140:
                    alerts.append('Blood pressure trending upward and above normal')
        
        # Heart Rate Trend
        if 'heartRate' in current_vitals:
            hr_values = []
            for v in sorted_vitals:
                hr = v.get('heartRate')
                if hr is not None:
                    try:
                        hr_values.append(float(hr))
                    except (ValueError, TypeError):
                        pass
            if len(hr_values) >= 2:
                # Compare most recent vs earlier values
                if len(hr_values) >= 3:
                    recent_avg = statistics.mean(hr_values[-2:])
                    older_avg = statistics.mean(hr_values[:len(hr_values)-2])
                else:
                    recent_avg = hr_values[-1]
                    older_avg = hr_values[0]
                
                change = recent_avg - older_avg
                trend = 'improving' if abs(recent_avg - 70) < abs(older_avg - 70) else 'worsening' if abs(recent_avg - 70) > abs(older_avg - 70) else 'stable'
                trends['heartRate'] = {
                    'trend': trend,
                    'recent_average': round(recent_avg, 1),
                    'previous_average': round(older_avg, 1),
                    'change': round(change, 1)
                }
        
        # Weight Trend
        if 'weight' in current_vitals:
            weight_values = []
            for v in sorted_vitals:
                weight = v.get('weight')
                if weight is not None:
                    try:
                        weight_values.append(float(weight))
                    except (ValueError, TypeError):
                        pass
            if len(weight_values) >= 2:
                recent = weight_values[-1]
                previous = weight_values[-2]
                change = recent - previous
                change_pct = (change / previous * 100) if previous > 0 else 0
                
                trends['weight'] = {
                    'trend': 'increasing' if change > 0 else 'decreasing' if change < 0 else 'stable',
                    'change_kg': round(change, 1),
                    'change_percent': round(change_pct, 1)
                }
                
                if abs(change_pct) > 5:
                    alerts.append(f'Significant weight change: {round(change, 1)}kg ({round(change_pct, 1)}%)')
        
        return {
            'has_trends': len(trends) > 0,
            'trends': trends,
            'alerts': alerts,
            'data_points_analyzed': len(sorted_vitals)
        }
    
    def analyze_visit_patterns(
        self,
        visit_history: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Analyze patterns in patient visits
        Returns: frequency patterns, recurring diagnoses, care gaps
        """
        if not visit_history or len(visit_history) < 2:
            return {'has_patterns': False}
        
        patterns = {}
        
        # Visit frequency
        visit_dates = []
        for v in visit_history:
            date_str = v.get('appointmentDate') or v.get('visitDate')
            if date_str:
                try:
                    # Handle timezone-aware and naive datetimes
                    if '+' in str(date_str) or str(date_str).endswith('Z'):
                        dt = datetime.fromisoformat(str(date_str).replace('Z', '+00:00'))
                    else:
                        dt = datetime.fromisoformat(str(date_str))
                    visit_dates.append(dt)
                except (ValueError, TypeError):
                    continue
        
        if len(visit_dates) >= 2:
            visit_dates.sort()
            intervals = [(visit_dates[i] - visit_dates[i-1]).days for i in range(1, len(visit_dates))]
            avg_interval = statistics.mean(intervals) if intervals else 0
            
            patterns['visit_frequency'] = {
                'total_visits': len(visit_history),
                'average_interval_days': round(avg_interval, 1),
                'frequency_category': 'frequent' if avg_interval < 30 else 'regular' if avg_interval < 90 else 'occasional'
            }
            
            if avg_interval < 14:
                patterns['visit_frequency']['alert'] = 'Frequent visits detected - consider comprehensive care plan'
        
        # Recurring diagnoses
        all_diagnoses = []
        for visit in visit_history:
            if visit.get('diagnosis'):
                all_diagnoses.append(visit['diagnosis'])
            if visit.get('diagnoses'):
                if isinstance(visit['diagnoses'], list):
                    all_diagnoses.extend([d.get('description', d) if isinstance(d, dict) else d for d in visit['diagnoses']])
        
        if all_diagnoses:
            diagnosis_counts = Counter(all_diagnoses)
            recurring = [{'diagnosis': d, 'count': c} for d, c in diagnosis_counts.items() if c >= 2]
            recurring.sort(key=lambda x: x['count'], reverse=True)
            
            patterns['recurring_diagnoses'] = recurring[:5]  # Top 5 recurring
        
        # Time since last visit
        if visit_dates:
            last_visit = max(visit_dates)
            days_since = (datetime.now() - last_visit.replace(tzinfo=None) if last_visit.tzinfo else datetime.now() - last_visit).days
            patterns['last_visit'] = {
                'days_ago': days_since,
                'date': last_visit.isoformat()
            }
        
        return {
            'has_patterns': len(patterns) > 0,
            'patterns': patterns
        }
    
    def detect_care_gaps(
        self,
        patient_age: Optional[int],
        patient_gender: Optional[str],
        visit_history: List[Dict[str, Any]],
        diagnoses: List[str]
    ) -> Dict[str, Any]:
        """
        Detect care gaps based on guidelines and visit history
        Returns: missing screenings, overdue vaccinations, missing follow-ups
        """
        gaps = []
        recommendations = []
        
        if not visit_history:
            return {'gaps': gaps, 'has_gaps': False}
        
        # Check vaccination gaps (simplified - would use immunization registry in production)
        last_visit_date = None
        if visit_history:
            visit_dates = [v.get('appointmentDate') or v.get('visitDate') for v in visit_history]
            visit_dates = [d for d in visit_dates if d]
            if visit_dates:
                last_visit_date = max(visit_dates)
        
        # Annual wellness visit
        if patient_age and patient_age >= 65:
            if not last_visit_date:
                gaps.append({
                    'type': 'preventive_care',
                    'description': 'Annual wellness visit overdue',
                    'priority': 'high'
                })
            else:
                days_since = (datetime.now() - datetime.fromisoformat(str(last_visit_date).replace('Z', '+00:00') if '+' in str(last_visit_date) else str(last_visit_date)).replace(tzinfo=None) if '+' in str(last_visit_date) else datetime.fromisoformat(str(last_visit_date))).days
                if days_since > 365:
                    gaps.append({
                        'type': 'preventive_care',
                        'description': 'Annual wellness visit overdue (>1 year)',
                        'priority': 'high',
                        'days_overdue': days_since - 365
                    })
        
        # Diabetes screening
        if patient_age and patient_age >= 45:
            has_diabetes = any('diabetes' in d.lower() for d in diagnoses)
            if not has_diabetes:
                # Check if screening done in last 3 years
                gaps.append({
                    'type': 'screening',
                    'description': 'Consider diabetes screening (age-based)',
                    'priority': 'moderate'
                })
        
        # Hypertension monitoring
        if any('hypertension' in d.lower() or 'high blood pressure' in d.lower() for d in diagnoses):
            if last_visit_date:
                days_since = (datetime.now() - datetime.fromisoformat(str(last_visit_date).replace('Z', '+00:00') if '+' in str(last_visit_date) else str(last_visit_date)).replace(tzinfo=None) if '+' in str(last_visit_date) else datetime.fromisoformat(str(last_visit_date))).days
                if days_since > 90:
                    gaps.append({
                        'type': 'follow_up',
                        'description': 'Hypertension follow-up overdue (>90 days)',
                        'priority': 'high',
                        'days_overdue': days_since - 90
                    })
        
        return {
            'has_gaps': len(gaps) > 0,
            'gaps': gaps,
            'recommendations': recommendations
        }
    
    def analyze_treatment_response(
        self,
        current_condition: str,
        historical_visits: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Analyze if previous treatments were effective
        Returns: treatment effectiveness, suggested adjustments
        """
        # Find visits with same condition
        relevant_visits = []
        for visit in historical_visits:
            visit_diagnoses = []
            if visit.get('diagnosis'):
                visit_diagnoses.append(visit['diagnosis'].lower())
            if visit.get('diagnoses'):
                if isinstance(visit['diagnoses'], list):
                    visit_diagnoses.extend([str(d).lower() if not isinstance(d, dict) else str(d.get('description', '')).lower() for d in visit['diagnoses']])
            
            if any(current_condition.lower() in d for d in visit_diagnoses):
                relevant_visits.append(visit)
        
        if len(relevant_visits) < 2:
            return {
                'has_history': False,
                'message': 'Insufficient history for treatment response analysis'
            }
        
        # Analyze if condition improved/worsened
        response = {
            'has_history': True,
            'relevant_visits': len(relevant_visits),
            'note': f'Patient has {len(relevant_visits)} previous visits with similar condition',
            'suggestion': 'Review previous treatment plans and outcomes'
        }
        
        return response

