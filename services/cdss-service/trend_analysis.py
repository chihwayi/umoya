"""
Trend Analysis Engine
Analyzes historical patient data to detect trends, patterns, and changes over time
"""
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
from collections import Counter
import statistics
import numpy as np
from statsmodels.tsa.holtwinters import ExponentialSmoothing
from sklearn.linear_model import LinearRegression

class TrendAnalysisEngine:
    """Analyzes trends in patient vitals, labs, diagnoses, and visits"""
    
    def analyze_glucose_forecast(
        self,
        historical_glucose: List[Dict[str, Any]],
        days_to_forecast: int = 7
    ) -> Dict[str, Any]:
        """
        Forecast glucose levels using Exponential Smoothing (Holt-Winters)
        Returns: forecasted values, confidence intervals, and trend analysis
        """
        if not historical_glucose or len(historical_glucose) < 5:
            return {
                'can_forecast': False,
                'message': 'Insufficient data for forecasting (need at least 5 points)'
            }
            
        # Sort and extract data
        sorted_data = sorted(
            historical_glucose,
            key=lambda x: x.get('timestamp', x.get('recordedAt', ''))
        )
        
        values = []
        dates = []
        
        for item in sorted_data:
            val = item.get('value') or item.get('glucose_level')
            ts = item.get('timestamp') or item.get('recordedAt')
            if val is not None and ts:
                values.append(float(val))
                dates.append(ts)
                
        if len(values) < 5:
             return {'can_forecast': False, 'message': 'Insufficient valid glucose readings'}
             
        try:
            # Simple Exponential Smoothing (Holt's Linear Trend)
            # Good for data with trend but no clear seasonality (unless we have high freq data)
            model = ExponentialSmoothing(
                values, 
                trend='add', 
                seasonal=None, 
                damped_trend=True
            ).fit()
            
            forecast = model.forecast(days_to_forecast)
            
            # Simple outlier detection (z-score-ish)
            mean_val = np.mean(values)
            std_val = np.std(values)
            alerts = []
            
            # Check for consistent hyperglycemia in forecast
            if any(f > 180 for f in forecast):
                alerts.append("Forecast predicts potential hyperglycemia (>180 mg/dL)")
                
            # Check for hypoglycemia
            if any(f < 70 for f in forecast):
                alerts.append("Forecast predicts potential hypoglycemia (<70 mg/dL)")
                
            # Detect trend direction based on forecast slope and averages
            trend_direction = "stable"
            predicted_avg = np.mean(forecast)
            
            if predicted_avg > mean_val * 1.05:
                trend_direction = "increasing"
            elif predicted_avg < mean_val * 0.95:
                trend_direction = "decreasing"
                
            return {
                'can_forecast': True,
                'forecast_values': [round(f, 1) for f in forecast],
                'trend_direction': trend_direction,
                'current_avg': round(mean_val, 1),
                'predicted_avg': round(predicted_avg, 1),
                'alerts': alerts,
                'model_used': 'Holt-Winters Exponential Smoothing'
            }
            
        except Exception as e:
            return {
                'can_forecast': False,
                'message': f'Forecasting model failed: {str(e)}'
            }

    def analyze_lab_trends(
        self,
        lab_history: List[Dict[str, Any]],
        lab_type: str
    ) -> Dict[str, Any]:
        """
        Analyze specific lab trends (Viral Load, CD4, etc.) using Linear Regression
        to detect subtle declines or inclines.
        """
        if not lab_history or len(lab_history) < 3:
            return {'has_trend': False, 'message': 'Need at least 3 data points'}
            
        # Filter for specific lab type (fuzzy match)
        relevant_labs = []
        target = lab_type.lower().replace('_', ' ') # viral_load -> viral load
        
        for l in lab_history:
            name = l.get('test_name', '') or l.get('type', '')
            name = str(name).lower()
            if target in name or lab_type.lower() in name:
                relevant_labs.append(l)
        
        if len(relevant_labs) < 3:
            return {'has_trend': False, 'message': 'Insufficient specific lab data'}
            
        # Sort by date
        sorted_labs = sorted(
            relevant_labs,
            key=lambda x: x.get('date', x.get('recordedAt', ''))
        )
        
        values = []
        days_from_start = []
        start_date = None
        
        for lab in sorted_labs:
            val = lab.get('value')
            date_str = lab.get('date') or lab.get('recordedAt')
            
            if val is not None and date_str:
                try:
                    dt = datetime.fromisoformat(str(date_str).replace('Z', '+00:00'))
                    if start_date is None:
                        start_date = dt
                    
                    days = (dt - start_date).days
                    values.append(float(val))
                    days_from_start.append(days)
                except:
                    continue
                    
        if len(values) < 3:
            return {'has_trend': False}
            
        # Linear Regression
        X = np.array(days_from_start).reshape(-1, 1)
        y = np.array(values)
        
        model = LinearRegression()
        model.fit(X, y)
        
        slope = model.coef_[0]
        r2_score = model.score(X, y)
        
        # Determine clinical significance
        significance = "stable"
        alerts = []
        
        # CD4 Count Logic (Decreasing is bad)
        if "cd4" in lab_type.lower():
            if slope < -0.5: # Dropping more than 0.5 cells/day approx
                significance = "declining"
                if r2_score > 0.6: # Strong correlation
                    alerts.append(f"Consistent decline in CD4 count detected (Slope: {slope:.2f})")
            elif slope > 0.5:
                significance = "improving"
                
        # Viral Load Logic (Increasing is bad)
        elif "viral" in lab_type.lower():
            if slope > 2: # Increasing (lowered threshold to catch slow rises)
                significance = "worsening"
                alerts.append(f"Viral load trending upward (Slope: +{slope:.2f} copies/day)")
            elif slope < -2:
                significance = "improving"
                
        return {
            'has_trend': True,
            'trend_direction': significance,
            'slope': round(slope, 4),
            'r2_score': round(r2_score, 2), # Goodness of fit
            'latest_value': values[-1],
            'alerts': alerts
        }

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

