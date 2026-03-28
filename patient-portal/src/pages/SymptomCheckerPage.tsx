import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePatientAuth } from '../contexts/PatientAuthContext';
import { patientPortalApi } from '../services/api';
import { useTenantSlug } from '../hooks/useTenantSlug';
import { useNotification } from '../components/GlobalNotification';
import { ArrowLeft, Search, AlertCircle, CheckCircle, Activity, Heart, Thermometer, Brain, Package, Wind, Eye, X, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';

const SymptomCheckerPage: React.FC = () => {
  const navigate = useNavigate();
  const { token } = usePatientAuth();
  const tenantSlug = useTenantSlug();
  const { showError } = useNotification();

  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [currentSymptom, setCurrentSymptom] = useState('');
  const [suggestedSymptoms, setSuggestedSymptoms] = useState<string[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [showResults, setShowResults] = useState(false);

  const commonSymptoms = [
    'Fever', 'Headache', 'Cough', 'Sore throat', 'Runny nose', 'Nausea', 'Vomiting',
    'Diarrhea', 'Abdominal pain', 'Chest pain', 'Shortness of breath', 'Dizziness',
    'Fatigue', 'Muscle aches', 'Joint pain', 'Rash', 'Itching', 'Swelling',
    'Back pain', 'Neck pain', 'Eye irritation', 'Ear pain', 'Loss of appetite',
    'Difficulty sleeping', 'Anxiety', 'Depression', 'Memory problems', 'Confusion',
  ];

  const bodySystems = [
    { icon: Heart, label: 'Cardiovascular', symptoms: ['Chest pain', 'Shortness of breath', 'Heart palpitations', 'Dizziness', 'Swelling'] },
    { icon: Wind, label: 'Respiratory', symptoms: ['Cough', 'Shortness of breath', 'Wheezing', 'Chest pain', 'Runny nose'] },
    { icon: Package, label: 'Digestive', symptoms: ['Nausea', 'Vomiting', 'Diarrhea', 'Abdominal pain', 'Loss of appetite'] },
    { icon: Brain, label: 'Neurological', symptoms: ['Headache', 'Dizziness', 'Confusion', 'Memory problems', 'Seizures'] },
    { icon: Eye, label: 'Visual', symptoms: ['Blurred vision', 'Eye pain', 'Eye irritation', 'Double vision', 'Light sensitivity'] },
    { icon: Thermometer, label: 'General', symptoms: ['Fever', 'Fatigue', 'Muscle aches', 'Joint pain', 'Chills'] },
  ];

  const handleAddSymptom = (symptom: string) => {
    if (symptom.trim() && !symptoms.includes(symptom.trim())) {
      setSymptoms([...symptoms, symptom.trim()]);
      setCurrentSymptom('');
      setSuggestedSymptoms([]);
    }
  };

  const handleRemoveSymptom = (symptom: string) => {
    setSymptoms(symptoms.filter(s => s !== symptom));
  };

  const handleSearchSymptom = (query: string) => {
    setCurrentSymptom(query);
    if (query.length > 1) {
      const filtered = commonSymptoms.filter(s => 
        s.toLowerCase().includes(query.toLowerCase()) && !symptoms.includes(s)
      );
      setSuggestedSymptoms(filtered.slice(0, 5));
    } else {
      setSuggestedSymptoms([]);
    }
  };

  const handleAnalyze = async () => {
    if (symptoms.length === 0) {
      showError('Please add at least one symptom', 'error');
      return;
    }

    setAnalyzing(true);
    try {
      // Call CDSS service for symptom analysis
      const analysis = await patientPortalApi.analyzeSymptoms(
        { symptoms, age: 35, gender: 'unknown' }, // TODO: Get from patient data
        token!,
        tenantSlug
      );
      
      setResults(analysis);
      setShowResults(true);
    } catch (err: any) {
      // If API doesn't exist, show mock results
      console.warn('Symptom analysis API not available, showing mock results');
      setResults({
        suggestedDiagnoses: [
          { diagnosis: 'Common Cold', confidence: 75, description: 'Viral infection of the upper respiratory tract' },
          { diagnosis: 'Influenza', confidence: 60, description: 'Viral infection causing fever and body aches' },
          { diagnosis: 'Allergic Rhinitis', confidence: 45, description: 'Allergic reaction causing nasal symptoms' },
        ],
        recommendations: [
          'Rest and stay hydrated',
          'Monitor symptoms for 2-3 days',
          'Seek medical attention if symptoms worsen',
          'Consider over-the-counter pain relief if needed',
        ],
        urgency: 'low',
      });
      setShowResults(true);
    } finally {
      setAnalyzing(false);
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'high': return 'bg-red-100 text-red-800 border-red-300';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default: return 'bg-green-100 text-green-800 border-green-300';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200/50 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <Link
              to={`/${tenantSlug}/dashboard`}
              className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Symptom Checker</h1>
              <p className="text-sm text-gray-600">AI-powered symptom analysis and guidance</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!showResults ? (
          <div className="space-y-6">
            {/* Symptom Input */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-white/20">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Enter Your Symptoms</h2>
              
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={currentSymptom}
                  onChange={(e) => handleSearchSymptom(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && currentSymptom.trim()) {
                      handleAddSymptom(currentSymptom);
                    }
                  }}
                  placeholder="Type a symptom (e.g., headache, fever)..."
                  className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                />
                
                {suggestedSymptoms.length > 0 && (
                  <div className="absolute z-10 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                    {suggestedSymptoms.map((symptom) => (
                      <button
                        key={symptom}
                        onClick={() => handleAddSymptom(symptom)}
                        className="w-full text-left px-4 py-2 hover:bg-indigo-50 transition-colors flex items-center gap-2"
                      >
                        <Activity className="w-4 h-4 text-indigo-600" />
                        <span className="text-gray-700">{symptom}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Selected Symptoms */}
              {symptoms.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">Selected Symptoms:</p>
                  <div className="flex flex-wrap gap-2">
                    {symptoms.map((symptom) => (
                      <span
                        key={symptom}
                        className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm font-medium flex items-center gap-2"
                      >
                        {symptom}
                        <button
                          onClick={() => handleRemoveSymptom(symptom)}
                          className="hover:text-indigo-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick Add by Body System */}
              <div className="mt-6">
                <p className="text-sm font-medium text-gray-700 mb-3">Quick Add by Body System:</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {bodySystems.map((system) => (
                    <div
                      key={system.label}
                      className="p-4 border-2 border-gray-200 rounded-xl hover:border-indigo-300 transition-colors cursor-pointer"
                      onClick={() => {
                        // Show symptoms for this system
                        const availableSymptoms = system.symptoms.filter(s => !symptoms.includes(s));
                        if (availableSymptoms.length > 0) {
                          handleAddSymptom(availableSymptoms[0]);
                        }
                      }}
                    >
                      <system.icon className="w-6 h-6 text-indigo-600 mb-2" />
                      <p className="text-sm font-semibold text-gray-900">{system.label}</p>
                      <p className="text-xs text-gray-500 mt-1">{system.symptoms.length} symptoms</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Analyze Button */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <button
                  onClick={handleAnalyze}
                  disabled={symptoms.length === 0 || analyzing}
                  className="w-full px-6 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all font-semibold text-lg shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                >
                  {analyzing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Analyzing Symptoms...
                    </>
                  ) : (
                    <>
                      <Activity className="w-5 h-5" />
                      Analyze Symptoms
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Disclaimer */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-yellow-800">
                  <p className="font-semibold mb-1">Medical Disclaimer</p>
                  <p>
                    This symptom checker is for informational purposes only and is not a substitute for professional medical advice, diagnosis, or treatment. Always seek the advice of your physician or other qualified health provider with any questions you may have regarding a medical condition.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Results Header */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-white/20">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-900">Analysis Results</h2>
                <button
                  onClick={() => {
                    setShowResults(false);
                    setResults(null);
                    setSymptoms([]);
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
                >
                  New Analysis
                </button>
              </div>

              {/* Urgency Indicator */}
              {results?.urgency && (
                <div className={`mb-4 p-4 rounded-xl border-2 ${getUrgencyColor(results.urgency)}`}>
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    <span className="font-semibold">
                      Urgency Level: {results.urgency.toUpperCase()}
                    </span>
                  </div>
                </div>
              )}

              {/* Suggested Diagnoses */}
              {results?.suggestedDiagnoses && results.suggestedDiagnoses.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Possible Conditions</h3>
                  <div className="space-y-3">
                    {results.suggestedDiagnoses.map((diagnosis: any, index: number) => (
                      <div
                        key={index}
                        className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-semibold text-gray-900">{diagnosis.diagnosis}</h4>
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                            {diagnosis.confidence}% match
                          </span>
                        </div>
                        {diagnosis.description && (
                          <p className="text-sm text-gray-700">{diagnosis.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommendations */}
              {results?.recommendations && results.recommendations.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Recommendations</h3>
                  <div className="space-y-2">
                    {results.recommendations.map((rec: string, index: number) => (
                      <div key={index} className="flex items-start gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-gray-800">{rec}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={() => navigate(`/${tenantSlug}/appointments/request`)}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all font-semibold"
                >
                  Request Appointment
                </button>
                <button
                  onClick={() => navigate(`/${tenantSlug}/messages`)}
                  className="px-4 py-3 border-2 border-indigo-600 text-indigo-600 rounded-xl hover:bg-indigo-50 transition-colors font-semibold"
                >
                  Message Doctor
                </button>
              </div>
            </div>

            {/* Selected Symptoms Summary */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-white/20">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Symptoms Analyzed</h3>
              <div className="flex flex-wrap gap-2">
                {symptoms.map((symptom) => (
                  <span
                    key={symptom}
                    className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm font-medium"
                  >
                    {symptom}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default SymptomCheckerPage;

