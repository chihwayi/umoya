import React, { useState, useEffect } from 'react';
import {
  AlertTriangle, Heart, Shield, Droplets, Activity, Eye,
  Bell, X, CheckCircle, Clock, User, MapPin, Pill
} from 'lucide-react';

interface SafetyAlert {
  id: string;
  patientId: string;
  patientName: string;
  patientRoom?: string;
  alertType: 'allergy' | 'fall_risk' | 'isolation' | 'critical_vitals' | 'medication' | 'lab' | 'general';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  details?: string;
  createdAt: string;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  isActive: boolean;
  requiresAction: boolean;
  actionRequired?: string;
  relatedData?: any;
}

interface PatientSafetyAlertsProps {
  currentUser: any;
  appointments: any[];
  onAlertAcknowledge?: (alertId: string) => void;
  onAlertDismiss?: (alertId: string) => void;
  onAlertCountsChange?: (counts: { active: number; critical: number; high: number }) => void;
}

const PatientSafetyAlerts: React.FC<PatientSafetyAlertsProps> = ({
  currentUser,
  appointments,
  onAlertAcknowledge,
  onAlertDismiss,
  onAlertCountsChange
}) => {
  const [alerts, setAlerts] = useState<SafetyAlert[]>([]);
  const [filteredAlerts, setFilteredAlerts] = useState<SafetyAlert[]>([]);
  const [filterSeverity, setFilterSeverity] = useState<'all' | 'low' | 'medium' | 'high' | 'critical'>('all');
  const [filterType, setFilterType] = useState<'all' | 'allergy' | 'fall_risk' | 'isolation' | 'critical_vitals' | 'medication' | 'lab' | 'general'>('all');
  const [showAcknowledged, setShowAcknowledged] = useState(false);

  // Generate real safety alerts based on actual patient data
  useEffect(() => {
    const generateRealAlerts = () => {
      const realAlerts: SafetyAlert[] = [];
      const now = new Date();

      appointments.forEach((apt, index) => {
        const patientName = `${apt.patient.firstName} ${apt.patient.lastName}`;

        // Only create alerts based on actual patient data
        if (apt.patient.allergies && apt.patient.allergies.length > 0) {
          realAlerts.push({
            id: `allergy-${apt.id}`,
            patientId: apt.patient.id,
            patientName,
            alertType: 'allergy',
            severity: 'high',
            title: 'Known Allergies',
            description: `Patient has known allergies: ${apt.patient.allergies}`,
            details: 'Verify all medications and treatments for allergen exposure',
            createdAt: now.toISOString(),
            isActive: true,
            requiresAction: true,
            actionRequired: 'Verify medication compatibility',
            relatedData: { allergies: apt.patient.allergies }
          });
        }

        // Fall risk alerts based on actual age
        if (apt.patient.age && apt.patient.age > 65) {
          realAlerts.push({
            id: `fall-${apt.id}`,
            patientId: apt.patient.id,
            patientName,
            alertType: 'fall_risk',
            severity: 'medium',
            title: 'Fall Risk Patient',
            description: `Patient age ${apt.patient.age} - high fall risk`,
            details: 'Implement fall prevention measures: bed alarm, non-slip socks, frequent checks',
            createdAt: now.toISOString(),
            isActive: true,
            requiresAction: true,
            actionRequired: 'Implement fall prevention protocol'
          });
        }

        // Critical vitals alerts based on actual vitals data
        if (apt.vitals) {
          const vitals = apt.vitals;
          
          // Check for critical blood pressure
          if (vitals.bloodPressure) {
            const bpValues = vitals.bloodPressure.split('/');
            if (bpValues.length === 2) {
              const systolic = parseInt(bpValues[0]);
              const diastolic = parseInt(bpValues[1]);
              
              if (systolic >= 180 || diastolic >= 110) {
                realAlerts.push({
                  id: `bp-${apt.id}`,
                  patientId: apt.patient.id,
                  patientName,
                  alertType: 'critical_vitals',
                  severity: 'critical',
                  title: 'Critical Blood Pressure',
                  description: `Blood pressure: ${vitals.bloodPressure} mmHg`,
                  details: 'Immediate medical attention required. Notify physician immediately.',
                  createdAt: now.toISOString(),
                  isActive: true,
                  requiresAction: true,
                  actionRequired: 'Notify physician immediately',
                  relatedData: { vitals }
                });
              }
            }
          }

          // Check for abnormal heart rate
          if (vitals.heartRate && (vitals.heartRate > 120 || vitals.heartRate < 50)) {
            realAlerts.push({
              id: `hr-${apt.id}`,
              patientId: apt.patient.id,
              patientName,
              alertType: 'critical_vitals',
              severity: 'high',
              title: 'Abnormal Heart Rate',
              description: `Heart rate: ${vitals.heartRate} bpm`,
              details: 'Heart rate outside normal range. Monitor closely.',
              createdAt: now.toISOString(),
              isActive: true,
              requiresAction: true,
              actionRequired: 'Monitor closely and reassess',
              relatedData: { vitals }
            });
          }

          // Check for abnormal temperature
          if (vitals.temperature && (vitals.temperature > 38.5 || vitals.temperature < 35)) {
            realAlerts.push({
              id: `temp-${apt.id}`,
              patientId: apt.patient.id,
              patientName,
              alertType: 'critical_vitals',
              severity: 'high',
              title: 'Abnormal Temperature',
              description: `Temperature: ${vitals.temperature}°C`,
              details: 'Temperature outside normal range. Consider infection or hypothermia.',
              createdAt: now.toISOString(),
              isActive: true,
              requiresAction: true,
              actionRequired: 'Assess for infection or other causes',
              relatedData: { vitals }
            });
          }

          // Check for low oxygen saturation
          if (vitals.oxygenSaturation && vitals.oxygenSaturation < 90) {
            realAlerts.push({
              id: `o2-${apt.id}`,
              patientId: apt.patient.id,
              patientName,
              alertType: 'critical_vitals',
              severity: 'critical',
              title: 'Low Oxygen Saturation',
              description: `Oxygen saturation: ${vitals.oxygenSaturation}%`,
              details: 'Oxygen saturation below 90%. Immediate attention required.',
              createdAt: now.toISOString(),
              isActive: true,
              requiresAction: true,
              actionRequired: 'Administer oxygen and notify physician',
              relatedData: { vitals }
            });
          }
        }
      });

      setAlerts(realAlerts);
    };

    if (appointments.length > 0) {
      generateRealAlerts();
    } else {
      setAlerts([]);
    }
  }, [appointments]);

  // Notify parent of alert count changes
  useEffect(() => {
    if (onAlertCountsChange) {
      const active = alerts.filter(alert => alert.isActive).length;
      const critical = alerts.filter(alert => alert.severity === 'critical' && alert.isActive).length;
      const high = alerts.filter(alert => alert.severity === 'high' && alert.isActive).length;
      onAlertCountsChange({ active, critical, high });
    }
  }, [alerts, onAlertCountsChange]);

  // Filter alerts
  useEffect(() => {
    let filtered = alerts.filter(alert => {
      const matchesSeverity = filterSeverity === 'all' || alert.severity === filterSeverity;
      const matchesType = filterType === 'all' || alert.alertType === filterType;
      const matchesAcknowledged = showAcknowledged || !alert.acknowledgedAt;
      return matchesSeverity && matchesType && matchesAcknowledged;
    });

    // Sort by severity and creation time
    filtered.sort((a, b) => {
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const severityComparison = severityOrder[b.severity] - severityOrder[a.severity];
      if (severityComparison !== 0) return severityComparison;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    setFilteredAlerts(filtered);
  }, [alerts, filterSeverity, filterType, showAcknowledged]);

  const getAlertIcon = (alertType: string) => {
    switch (alertType) {
      case 'allergy': return <AlertTriangle className="w-5 h-5" />;
      case 'fall_risk': return <Shield className="w-5 h-5" />;
      case 'isolation': return <Droplets className="w-5 h-5" />;
      case 'critical_vitals': return <Heart className="w-5 h-5" />;
      case 'medication': return <Pill className="w-5 h-5" />;
      case 'lab': return <Activity className="w-5 h-5" />;
      default: return <Bell className="w-5 h-5" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getAlertStats = () => {
    const total = alerts.length;
    const active = alerts.filter(a => a.isActive && !a.acknowledgedAt).length;
    const critical = alerts.filter(a => a.severity === 'critical' && !a.acknowledgedAt).length;
    const high = alerts.filter(a => a.severity === 'high' && !a.acknowledgedAt).length;
    const acknowledged = alerts.filter(a => a.acknowledgedAt).length;

    return { total, active, critical, high, acknowledged };
  };

  const handleAcknowledge = (alertId: string) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === alertId 
        ? { 
            ...alert, 
            acknowledgedBy: currentUser?.id || 'current_user',
            acknowledgedAt: new Date().toISOString(),
            isActive: false
          }
        : alert
    ));
    onAlertAcknowledge?.(alertId);
  };

  const handleDismiss = (alertId: string) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === alertId 
        ? { ...alert, isActive: false }
        : alert
    ));
    onAlertDismiss?.(alertId);
  };

  const stats = getAlertStats();

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg border border-slate-200/50 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-r from-red-500 to-orange-600 rounded-xl">
              <Bell className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Patient Safety Alerts</h2>
              <p className="text-slate-600">Critical alerts and safety notifications</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-slate-600">Last Updated</p>
            <p className="text-lg font-semibold text-slate-900">
              {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white rounded-lg p-4 border border-slate-200">
            <div className="flex items-center gap-2 mb-2">
              <Bell className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-semibold text-slate-700">Total</span>
            </div>
            <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-slate-200">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-yellow-600" />
              <span className="text-sm font-semibold text-slate-700">Active</span>
            </div>
            <p className="text-2xl font-bold text-yellow-600">{stats.active}</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-slate-200">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <span className="text-sm font-semibold text-slate-700">Critical</span>
            </div>
            <p className="text-2xl font-bold text-red-600">{stats.critical}</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-slate-200">
            <div className="flex items-center gap-2 mb-2">
              <Heart className="w-4 h-4 text-orange-600" />
              <span className="text-sm font-semibold text-slate-700">High</span>
            </div>
            <p className="text-2xl font-bold text-orange-600">{stats.high}</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-slate-200">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span className="text-sm font-semibold text-slate-700">Acknowledged</span>
            </div>
            <p className="text-2xl font-bold text-green-600">{stats.acknowledged}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200/50 p-6">
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <div className="flex-1">
            <label className="block text-sm font-semibold text-slate-700 mb-2">Filter by Severity</label>
            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value as any)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-semibold text-slate-700 mb-2">Filter by Type</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
            >
              <option value="all">All Types</option>
              <option value="allergy">Allergies</option>
              <option value="fall_risk">Fall Risk</option>
              <option value="isolation">Isolation</option>
              <option value="critical_vitals">Critical Vitals</option>
              <option value="medication">Medication</option>
              <option value="lab">Lab Results</option>
              <option value="general">General</option>
            </select>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={showAcknowledged}
                onChange={(e) => setShowAcknowledged(e.target.checked)}
                className="rounded border-slate-300 text-red-600 focus:ring-red-500"
              />
              <span className="text-sm text-slate-700">Show acknowledged</span>
            </label>
          </div>
        </div>
      </div>

      {/* Alert List */}
      <div className="space-y-4">
        {filteredAlerts.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl shadow-lg border border-slate-200/50">
            <Bell className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-600 mb-2">No Alerts Found</h3>
            <p className="text-slate-500">No alerts match your current filters.</p>
          </div>
        ) : (
          filteredAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`bg-white rounded-xl border-2 transition-all duration-200 hover:shadow-lg ${
                alert.severity === 'critical' ? 'border-red-200 bg-red-50/30' :
                alert.severity === 'high' ? 'border-orange-200 bg-orange-50/30' :
                alert.severity === 'medium' ? 'border-yellow-200 bg-yellow-50/30' :
                'border-slate-200 hover:border-blue-200'
              }`}
            >
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <div className={`p-2 rounded-lg ${
                      alert.severity === 'critical' ? 'bg-red-100 text-red-600' :
                      alert.severity === 'high' ? 'bg-orange-100 text-orange-600' :
                      alert.severity === 'medium' ? 'bg-yellow-100 text-yellow-600' :
                      'bg-blue-100 text-blue-600'
                    }`}>
                      {getAlertIcon(alert.alertType)}
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-slate-900">{alert.title}</h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${getSeverityColor(alert.severity)}`}>
                          {alert.severity.toUpperCase()}
                        </span>
                        {alert.requiresAction && (
                          <span className="px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-200">
                            ACTION REQUIRED
                          </span>
                        )}
                        {alert.acknowledgedAt && (
                          <span className="px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 border border-green-200">
                            ACKNOWLEDGED
                          </span>
                        )}
                      </div>
                      
                      <p className="text-slate-600 mb-3">{alert.description}</p>
                      
                      {alert.details && (
                        <p className="text-sm text-slate-500 mb-3">{alert.details}</p>
                      )}

                      {alert.actionRequired && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
                          <p className="text-sm font-semibold text-amber-800 mb-1">Action Required:</p>
                          <p className="text-sm text-amber-700">{alert.actionRequired}</p>
                        </div>
                      )}
                      
                      <div className="flex items-center gap-6 text-sm text-slate-500">
                        {alert.patientId !== 'system' && (
                          <div className="flex items-center gap-1">
                            <User className="w-4 h-4" />
                            <span>{alert.patientName}</span>
                            {alert.patientRoom && <span>• {alert.patientRoom}</span>}
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          <span>{new Date(alert.createdAt).toLocaleString()}</span>
                        </div>
                        {alert.acknowledgedAt && (
                          <div className="flex items-center gap-1 text-green-600">
                            <CheckCircle className="w-4 h-4" />
                            <span>Acknowledged {new Date(alert.acknowledgedAt).toLocaleTimeString()}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    {!alert.acknowledgedAt && (
                      <button
                        onClick={() => handleAcknowledge(alert.id)}
                        className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all duration-200 font-semibold text-sm flex items-center gap-1"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Acknowledge
                      </button>
                    )}
                    
                    <button
                      onClick={() => handleDismiss(alert.id)}
                      className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all duration-200"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default PatientSafetyAlerts;
