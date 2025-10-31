import React from 'react';
import { AlertTriangle, AlertCircle, X, Info } from 'lucide-react';
import { VitalsAlert, checkVitalsAlerts, VitalsData } from '../utils/vitalsAlerts';

interface ClinicalAlertsProps {
  vitals?: VitalsData;
  allergies?: Array<{ allergen: string; severity?: string; reaction?: string }>;
  onDismiss?: () => void;
  className?: string;
}

const ClinicalAlerts: React.FC<ClinicalAlertsProps> = ({ 
  vitals, 
  allergies, 
  onDismiss,
  className = '' 
}) => {
  const vitalsAlerts = vitals ? checkVitalsAlerts(vitals) : [];
  const criticalAlerts = vitalsAlerts.filter(a => a.type === 'critical');
  const warningAlerts = vitalsAlerts.filter(a => a.type === 'warning');
  const hasAllergies = allergies && allergies.length > 0;
  
  const allAlerts: Array<{
    type: 'critical' | 'warning' | 'info';
    title: string;
    message: string;
    recommendation?: string;
    icon: React.ReactNode;
  }> = [
    ...criticalAlerts.map(a => ({
      type: 'critical' as const,
      title: `Critical: ${a.vital}`,
      message: a.message,
      recommendation: a.recommendation,
      icon: <AlertCircle className="w-5 h-5" />
    })),
    ...warningAlerts.map(a => ({
      type: 'warning' as const,
      title: `Warning: ${a.vital}`,
      message: a.message,
      recommendation: a.recommendation,
      icon: <AlertTriangle className="w-5 h-5" />
    })),
    ...(hasAllergies ? allergies.filter(a => a.severity === 'severe').map(a => ({
      type: 'critical' as const,
      title: 'Severe Allergy',
      message: `Patient has severe allergy to ${a.allergen}${a.reaction ? `: ${a.reaction}` : ''}`,
      recommendation: 'Exercise extreme caution when prescribing medications.',
      icon: <AlertCircle className="w-5 h-5" />
    })) : [])
  ];

  if (allAlerts.length === 0) return null;

  return (
    <div className={`bg-gradient-to-r from-red-50 to-orange-50 border-2 border-red-300 rounded-xl shadow-lg ${className}`}>
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-6 h-6 text-red-600" />
            <h3 className="text-lg font-bold text-red-900">Clinical Alerts</h3>
          </div>
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="p-1 rounded-lg hover:bg-red-100 text-red-600"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
        
        <div className="space-y-3">
          {allAlerts.map((alert, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-lg border-l-4 ${
                alert.type === 'critical'
                  ? 'bg-red-100 border-red-500'
                  : alert.type === 'warning'
                  ? 'bg-orange-100 border-orange-500'
                  : 'bg-blue-100 border-blue-500'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 ${
                  alert.type === 'critical' ? 'text-red-600' : 
                  alert.type === 'warning' ? 'text-orange-600' : 
                  'text-blue-600'
                }`}>
                  {alert.icon}
                </div>
                <div className="flex-1">
                  <h4 className={`font-semibold text-sm ${
                    alert.type === 'critical' ? 'text-red-900' : 
                    alert.type === 'warning' ? 'text-orange-900' : 
                    'text-blue-900'
                  }`}>
                    {alert.title}
                  </h4>
                  <p className={`text-sm mt-1 ${
                    alert.type === 'critical' ? 'text-red-800' : 
                    alert.type === 'warning' ? 'text-orange-800' : 
                    'text-blue-800'
                  }`}>
                    {alert.message}
                  </p>
                  {alert.recommendation && (
                    <p className={`text-xs mt-2 italic ${
                      alert.type === 'critical' ? 'text-red-700' : 
                      alert.type === 'warning' ? 'text-orange-700' : 
                      'text-blue-700'
                    }`}>
                      💡 {alert.recommendation}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {hasAllergies && allergies!.filter(a => a.severity !== 'severe').length > 0 && (
          <div className="mt-3 pt-3 border-t border-amber-300">
            <div className="flex items-center gap-2 mb-2">
              <Info className="w-4 h-4 text-amber-600" />
              <p className="text-sm font-semibold text-amber-900">Other Allergies:</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {allergies!
                .filter(a => a.severity !== 'severe')
                .map((allergy, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-1 bg-amber-100 text-amber-800 rounded-lg text-xs border border-amber-300"
                  >
                    {allergy.allergen}
                    {allergy.severity && ` (${allergy.severity})`}
                  </span>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClinicalAlerts;

