import React, { useState, useEffect } from 'react';
import {
  X, Save, Activity, Heart, Thermometer, Droplets, Eye, 
  Weight, Ruler, Calculator, AlertTriangle, CheckCircle
} from 'lucide-react';
import { ehrApi } from '../services/api.ts';
import { useNotification } from '../components/GlobalNotification.tsx';

interface Patient {
  id: string;
  patientNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  bloodType: string;
  allergies: string;
  chronicConditions: string;
}

interface VitalsData {
  bloodPressureSystolic: number;
  bloodPressureDiastolic: number;
  heartRate: number;
  temperature: number;
  oxygenSaturation: number;
  respiratoryRate: number;
  weight: number;
  height: number;
  painLevel: number;
  bloodGlucose?: number;
  notes: string;
}

interface VitalsPanelProps {
  patient?: Patient;
  appointments?: any[];
  onClose?: () => void;
  onSave?: () => void;
}

const VitalsPanel: React.FC<VitalsPanelProps> = ({ patient, appointments = [], onClose, onSave }) => {
  const { showSuccess, showError } = useNotification();
  const [vitals, setVitals] = useState<VitalsData>({
    bloodPressureSystolic: 0,
    bloodPressureDiastolic: 0,
    heartRate: 0,
    temperature: 0,
    oxygenSaturation: 0,
    respiratoryRate: 0,
    weight: 0,
    height: 0,
    painLevel: 0,
    bloodGlucose: 0,
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [bmi, setBmi] = useState(0);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(patient || null);

  useEffect(() => {
    if (vitals.weight > 0 && vitals.height > 0) {
      const heightInMeters = vitals.height / 100;
      const calculatedBmi = vitals.weight / (heightInMeters * heightInMeters);
      setBmi(Number(calculatedBmi.toFixed(1)));
    }
  }, [vitals.weight, vitals.height]);

  const handleInputChange = (field: keyof VitalsData, value: string | number) => {
    setVitals(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const getBMICategory = (bmi: number) => {
    if (bmi < 18.5) return { category: 'Underweight', color: 'text-blue-600' };
    if (bmi < 25) return { category: 'Normal', color: 'text-green-600' };
    if (bmi < 30) return { category: 'Overweight', color: 'text-yellow-600' };
    return { category: 'Obese', color: 'text-red-600' };
  };

  const getVitalStatus = (value: number, type: string) => {
    switch (type) {
      case 'bloodPressure':
        if (value > 140) return { status: 'High', color: 'text-red-600' };
        if (value < 90) return { status: 'Low', color: 'text-blue-600' };
        return { status: 'Normal', color: 'text-green-600' };
      case 'heartRate':
        if (value > 100) return { status: 'High', color: 'text-red-600' };
        if (value < 60) return { status: 'Low', color: 'text-blue-600' };
        return { status: 'Normal', color: 'text-green-600' };
      case 'temperature':
        if (value > 37.5) return { status: 'Fever', color: 'text-red-600' };
        if (value < 36.0) return { status: 'Low', color: 'text-blue-600' };
        return { status: 'Normal', color: 'text-green-600' };
      case 'oxygenSaturation':
        if (value < 95) return { status: 'Low', color: 'text-red-600' };
        return { status: 'Normal', color: 'text-green-600' };
      default:
        return { status: 'Normal', color: 'text-green-600' };
    }
  };

  const handleSave = async () => {
    if (!selectedPatient) {
      showError('Error', 'No patient selected');
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('ehr_token');
      const tenantSlug = localStorage.getItem('ehr_tenant_slug');
      
      if (!token || !tenantSlug) {
        showError('Error', 'Authentication required');
        return;
      }

      const vitalsData = {
        patientId: selectedPatient.id,
        bloodPressure: `${vitals.bloodPressureSystolic}/${vitals.bloodPressureDiastolic}`,
        heartRate: vitals.heartRate,
        temperature: vitals.temperature,
        oxygenSaturation: vitals.oxygenSaturation,
        respiratoryRate: vitals.respiratoryRate,
        weight: vitals.weight,
        height: vitals.height,
        bmi: bmi,
        painLevel: vitals.painLevel,
        bloodGlucose: vitals.bloodGlucose,
        notes: vitals.notes,
        recordedAt: new Date().toISOString(),
        recordedBy: JSON.parse(localStorage.getItem('ehr_user') || '{}').id
      };

      await ehrApi.recordVitals(vitalsData, token, tenantSlug);
      showSuccess('Success', 'Vitals recorded successfully');
      onSave?.();
    } catch (error) {
      console.error('Error saving vitals:', error);
      showError('Error', 'Failed to save vitals');
    } finally {
      setLoading(false);
    }
  };

  const renderVitalInput = (
    label: string,
    field: keyof VitalsData,
    unit: string,
    icon: React.ReactNode,
    type: string = 'number',
    min?: number,
    max?: number,
    step?: number
  ) => {
    const value = vitals[field];
    const status = getVitalStatus(Number(value), type);
    
    return (
      <div className="p-4 bg-white/50 rounded-xl border border-slate-200/50">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 bg-gradient-to-r from-slate-100 to-slate-200 rounded-lg">
            {icon}
          </div>
          <label className="text-sm font-semibold text-slate-700">{label}</label>
          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
            status.status === 'Normal' ? 'bg-green-100 text-green-800' :
            status.status === 'High' || status.status === 'Fever' ? 'bg-red-100 text-red-800' :
            'bg-blue-100 text-blue-800'
          }`}>
            {status.status}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type={type}
            value={value}
            onChange={(e) => handleInputChange(field, Number(e.target.value))}
            min={min}
            max={max}
            step={step}
            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
            placeholder={`Enter ${label.toLowerCase()}`}
          />
          <span className="text-sm text-slate-500 font-medium">{unit}</span>
        </div>
      </div>
    );
  };

  const renderContent = () => {
    if (patient) {
      // Single patient vitals recording
      return (
        <div className="space-y-6">
          {/* Patient Info */}
          <div className="bg-gradient-to-r from-pink-50 to-rose-50 rounded-xl p-6 border border-pink-200/50">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-pink-500 to-rose-600 rounded-xl flex items-center justify-center text-white font-bold text-xl">
                {patient.firstName.charAt(0)}{patient.lastName.charAt(0)}
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">
                  {patient.firstName} {patient.lastName}
                </h3>
                <p className="text-slate-600">ID: {patient.patientNumber}</p>
                <p className="text-sm text-slate-500">
                  Blood Type: {patient.bloodType} • Allergies: {patient.allergies || 'None'}
                </p>
              </div>
            </div>
          </div>

          {/* Vitals Form */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {renderVitalInput(
              'Blood Pressure (Systolic)',
              'bloodPressureSystolic',
              'mmHg',
              <Heart className="w-4 h-4 text-red-600" />,
              'number',
              60,
              250
            )}
            {renderVitalInput(
              'Blood Pressure (Diastolic)',
              'bloodPressureDiastolic',
              'mmHg',
              <Heart className="w-4 h-4 text-red-600" />,
              'number',
              40,
              150
            )}
            {renderVitalInput(
              'Heart Rate',
              'heartRate',
              'bpm',
              <Activity className="w-4 h-4 text-red-600" />,
              'number',
              30,
              200
            )}
            {renderVitalInput(
              'Temperature',
              'temperature',
              '°C',
              <Thermometer className="w-4 h-4 text-orange-600" />,
              'number',
              30,
              45,
              0.1
            )}
            {renderVitalInput(
              'Oxygen Saturation',
              'oxygenSaturation',
              '%',
              <Droplets className="w-4 h-4 text-blue-600" />,
              'number',
              70,
              100
            )}
            {renderVitalInput(
              'Respiratory Rate',
              'respiratoryRate',
              'breaths/min',
              <Eye className="w-4 h-4 text-green-600" />,
              'number',
              8,
              40
            )}
            {renderVitalInput(
              'Weight',
              'weight',
              'kg',
              <Weight className="w-4 h-4 text-purple-600" />,
              'number',
              10,
              300,
              0.1
            )}
            {renderVitalInput(
              'Height',
              'height',
              'cm',
              <Ruler className="w-4 h-4 text-indigo-600" />,
              'number',
              50,
              250
            )}
            {renderVitalInput(
              'Pain Level',
              'painLevel',
              '/10',
              <AlertTriangle className="w-4 h-4 text-red-600" />,
              'number',
              0,
              10
            )}
            {renderVitalInput(
              'Blood Glucose',
              'bloodGlucose',
              'mg/dL',
              <Droplets className="w-4 h-4 text-green-600" />,
              'number',
              50,
              500
            )}
          </div>

          {/* BMI Display */}
          {bmi > 0 && (
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-6 border border-indigo-200/50">
              <div className="flex items-center gap-3 mb-2">
                <Calculator className="w-5 h-5 text-indigo-600" />
                <h4 className="text-lg font-bold text-slate-900">Body Mass Index (BMI)</h4>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-3xl font-bold text-indigo-600">{bmi}</span>
                <span className={`text-lg font-semibold ${getBMICategory(bmi).color}`}>
                  {getBMICategory(bmi).category}
                </span>
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="p-4 bg-white/50 rounded-xl border border-slate-200/50">
            <label className="block text-sm font-semibold text-slate-700 mb-3">Additional Notes</label>
            <textarea
              value={vitals.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent resize-none"
              rows={3}
              placeholder="Enter any additional observations or notes..."
            />
          </div>
        </div>
      );
    } else {
      // Vitals overview for all patients
      return (
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg border border-slate-200/50 p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-gradient-to-r from-pink-500 to-rose-600 rounded-xl">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Vitals Management</h3>
            </div>
            
            <div className="text-center py-8">
              <Activity className="w-16 h-16 text-slate-400 mx-auto mb-4" />
              <h4 className="text-lg font-semibold text-slate-900 mb-2">Select a Patient</h4>
              <p className="text-slate-600">Choose a patient from the queue to record their vitals</p>
            </div>
          </div>
        </div>
      );
    }
  };

  return (
    <div className="space-y-6">
      {renderContent()}
      
      {patient && (
        <div className="flex items-center justify-end gap-4 pt-6 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-6 py-3 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition-all duration-200 font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-6 py-3 bg-gradient-to-r from-pink-500 to-rose-600 text-white rounded-xl hover:from-pink-600 hover:to-rose-700 transition-all duration-200 font-semibold disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Vitals
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default VitalsPanel;
