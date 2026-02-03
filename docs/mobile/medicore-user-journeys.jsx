import React, { useState } from 'react';
import { ArrowLeft, Check, X, AlertTriangle, Camera, Upload, FileText, 
         Pill, Activity, TrendingUp, Calendar, Clock, User, Heart,
         Thermometer, Droplet, Wind, Zap, Plus, Minus, Send, MessageCircle } from 'lucide-react';

const MediCoreUserJourneys = () => {
  const [currentJourney, setCurrentJourney] = useState('vital-entry');
  const [journeyStep, setJourneyStep] = useState(0);

  // Glass Card Component
  const GlassCard = ({ children, className = '' }) => (
    <div className={`backdrop-blur-xl bg-white/70 dark:bg-gray-800/70 rounded-2xl border border-white/20 shadow-xl ${className}`}>
      {children}
    </div>
  );

  // Journey 1: Quick Vital Signs Entry (Nurse)
  const VitalEntryJourney = () => {
    const steps = [
      {
        title: 'Select Patient',
        component: (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Record Vitals</h2>
              <button className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                <Camera size={20} className="text-purple-600" />
              </button>
            </div>
            <div className="relative">
              <input 
                type="text" 
                placeholder="Search patient..." 
                className="w-full px-4 py-3 pl-12 rounded-xl backdrop-blur bg-white/50 dark:bg-gray-700/50 border border-white/20"
              />
              <User className="absolute left-4 top-3.5 text-gray-400" size={20} />
            </div>
            {['Sarah Moyo - A201', 'John Ncube - A203', 'Grace Chikwanha - B105'].map((patient, i) => (
              <GlassCard key={i} className="p-4 cursor-pointer hover:shadow-2xl transition-all">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">{patient.split(' - ')[0]}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Room {patient.split(' - ')[1]}</p>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-white text-sm font-bold">
                    {patient.charAt(0)}
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        )
      },
      {
        title: 'Enter Vitals',
        component: (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Sarah Moyo</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">34F · Room A-201</p>
              </div>
            </div>

            {/* Blood Pressure */}
            <GlassCard className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-red-500/20">
                  <Heart size={20} className="text-red-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">Blood Pressure</p>
                  <p className="text-xs text-gray-500">mmHg</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Systolic</label>
                  <input 
                    type="number" 
                    placeholder="120" 
                    className="w-full px-4 py-3 text-2xl font-bold text-center rounded-xl bg-white/50 dark:bg-gray-700/50 border border-white/20"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Diastolic</label>
                  <input 
                    type="number" 
                    placeholder="80" 
                    className="w-full px-4 py-3 text-2xl font-bold text-center rounded-xl bg-white/50 dark:bg-gray-700/50 border border-white/20"
                  />
                </div>
              </div>
            </GlassCard>

            {/* Heart Rate */}
            <GlassCard className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-pink-500/20">
                  <Activity size={20} className="text-pink-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">Heart Rate</p>
                  <p className="text-xs text-gray-500">bpm</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <button className="p-3 rounded-xl bg-purple-100 dark:bg-purple-900/30">
                  <Minus size={20} className="text-purple-600" />
                </button>
                <input 
                  type="number" 
                  placeholder="72" 
                  className="flex-1 px-4 py-4 text-3xl font-bold text-center rounded-xl bg-white/50 dark:bg-gray-700/50 border border-white/20"
                />
                <button className="p-3 rounded-xl bg-purple-100 dark:bg-purple-900/30">
                  <Plus size={20} className="text-purple-600" />
                </button>
              </div>
            </GlassCard>

            {/* Temperature */}
            <GlassCard className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-orange-500/20">
                  <Thermometer size={20} className="text-orange-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">Temperature</p>
                  <p className="text-xs text-gray-500">°C</p>
                </div>
              </div>
              <input 
                type="number" 
                step="0.1"
                placeholder="37.0" 
                className="w-full px-4 py-4 text-3xl font-bold text-center rounded-xl bg-white/50 dark:bg-gray-700/50 border border-white/20"
              />
            </GlassCard>

            {/* SpO2 */}
            <GlassCard className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-blue-500/20">
                  <Wind size={20} className="text-blue-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">Oxygen Saturation</p>
                  <p className="text-xs text-gray-500">SpO₂ %</p>
                </div>
              </div>
              <div className="space-y-2">
                <input 
                  type="range" 
                  min="80" 
                  max="100" 
                  defaultValue="98"
                  className="w-full h-2 rounded-lg appearance-none bg-gradient-to-r from-red-500 via-amber-500 to-emerald-500"
                />
                <p className="text-3xl font-bold text-center text-gray-900 dark:text-white">98%</p>
              </div>
            </GlassCard>

            <button className="w-full py-4 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-semibold shadow-lg">
              Save Vital Signs
            </button>
          </div>
        )
      },
      {
        title: 'Confirmation',
        component: (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center mb-6 animate-bounce">
              <Check size={48} className="text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Vitals Recorded</h2>
            <p className="text-gray-600 dark:text-gray-400 text-center mb-8">
              Vital signs for Sarah Moyo have been successfully saved
            </p>
            <GlassCard className="w-full p-6 mb-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">BP</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">120/80</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">HR</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">72 bpm</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Temp</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">37.0°C</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">SpO₂</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">98%</p>
                </div>
              </div>
            </GlassCard>
            <button className="w-full py-3 rounded-xl bg-white/50 dark:bg-gray-800/50 backdrop-blur border border-white/20 font-semibold">
              Record for Another Patient
            </button>
          </div>
        )
      }
    ];

    return steps[journeyStep].component;
  };

  // Journey 2: Medication Administration (Nurse)
  const MedicationJourney = () => {
    const steps = [
      {
        title: 'Scan Patient',
        component: (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Medication Administration</h2>
            <GlassCard className="p-8">
              <div className="flex flex-col items-center">
                <div className="w-48 h-48 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center mb-4">
                  <div className="w-40 h-40 bg-white rounded-xl flex items-center justify-center">
                    <div className="space-y-1">
                      {[...Array(8)].map((_, i) => (
                        <div key={i} className="flex gap-1">
                          {[...Array(8)].map((_, j) => (
                            <div key={j} className="w-3 h-3 bg-gray-900" style={{ opacity: Math.random() }}></div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <p className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Scan Patient Wristband</p>
                <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                  Position the barcode within the frame
                </p>
              </div>
            </GlassCard>
            <button className="w-full py-3 rounded-xl bg-white/50 dark:bg-gray-800/50 backdrop-blur border border-white/20 font-semibold">
              Enter Manually
            </button>
          </div>
        )
      },
      {
        title: 'Verify Medication',
        component: (
          <div className="space-y-4">
            <div className="mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Grace Chikwanha</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">42F · Room B-105 · Diabetes Management</p>
            </div>

            {/* Allergy Alert */}
            <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/20 border border-red-500/30">
              <AlertTriangle className="text-red-600" size={24} />
              <div>
                <p className="font-semibold text-red-700 dark:text-red-300">Allergy Alert</p>
                <p className="text-sm text-red-600 dark:text-red-400">Penicillin, Sulfa drugs</p>
              </div>
            </div>

            {/* Medication Card */}
            <GlassCard className="p-4">
              <div className="flex items-start gap-3 mb-4">
                <div className="p-3 rounded-xl bg-purple-500/20">
                  <Pill size={24} className="text-purple-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-1">Insulin Regular</h3>
                  <p className="text-gray-600 dark:text-gray-400">10 units · Subcutaneous</p>
                  <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">Scheduled: 08:00 AM</p>
                </div>
                <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 text-xs font-semibold">
                  DUE NOW
                </span>
              </div>

              {/* 5 Rights Checklist */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <p className="font-semibold text-gray-700 dark:text-gray-300 mb-3">5 Rights Check</p>
                <div className="space-y-2">
                  {[
                    'Right Patient: Grace Chikwanha',
                    'Right Medication: Insulin Regular',
                    'Right Dose: 10 units',
                    'Right Route: Subcutaneous',
                    'Right Time: 08:00 AM'
                  ].map((check, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                        <Check size={14} className="text-white" />
                      </div>
                      <span className="text-sm text-gray-700 dark:text-gray-300">{check}</span>
                    </div>
                  ))}
                </div>
              </div>
            </GlassCard>

            <div className="grid grid-cols-2 gap-3">
              <button className="py-3 rounded-xl bg-white/50 dark:bg-gray-800/50 backdrop-blur border border-white/20 font-semibold">
                Refuse
              </button>
              <button className="py-3 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-semibold shadow-lg">
                Administer
              </button>
            </div>
          </div>
        )
      },
      {
        title: 'Document',
        component: (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Administration Complete</h2>
            
            <GlassCard className="p-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Injection Site</p>
              <div className="grid grid-cols-2 gap-2">
                {['Left Arm', 'Right Arm', 'Abdomen', 'Thigh'].map((site) => (
                  <button key={site} className="py-2 px-4 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-medium">
                    {site}
                  </button>
                ))}
              </div>
            </GlassCard>

            <GlassCard className="p-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Notes (Optional)</p>
              <textarea 
                placeholder="Any observations or patient reactions..."
                className="w-full px-4 py-3 rounded-xl bg-white/50 dark:bg-gray-700/50 border border-white/20 resize-none"
                rows="4"
              />
            </GlassCard>

            <div className="p-4 rounded-xl bg-emerald-500/20 border border-emerald-500/30">
              <div className="flex items-center gap-2 mb-2">
                <Check className="text-emerald-600" size={20} />
                <p className="font-semibold text-emerald-700 dark:text-emerald-300">Auto-saved</p>
              </div>
              <p className="text-sm text-emerald-600 dark:text-emerald-400">
                Administered by Nurse J. Banda at 08:03 AM
              </p>
            </div>

            <button className="w-full py-4 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-semibold shadow-lg">
              Next Medication
            </button>
          </div>
        )
      }
    ];

    return steps[journeyStep].component;
  };

  // Journey 3: Critical Lab Result (Doctor)
  const LabResultJourney = () => (
    <div className="space-y-4">
      {/* Critical Alert Banner */}
      <div className="p-4 rounded-xl bg-red-500 text-white shadow-2xl shadow-red-500/30 animate-pulse">
        <div className="flex items-center gap-3">
          <AlertTriangle size={24} />
          <div>
            <p className="font-bold">CRITICAL LAB RESULT</p>
            <p className="text-sm opacity-90">Immediate attention required</p>
          </div>
        </div>
      </div>

      {/* Patient Info */}
      <GlassCard className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-bold text-lg text-gray-900 dark:text-white">John Ncube</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">58M · Room A-203 · Pneumonia</p>
          </div>
          <span className="px-3 py-1 rounded-full bg-red-500/20 text-red-700 dark:text-red-300 text-xs font-semibold border border-red-500/30">
            CRITICAL
          </span>
        </div>
      </GlassCard>

      {/* Lab Results */}
      <GlassCard className="p-4">
        <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Electrolyte Panel</h4>
        <div className="space-y-3">
          {[
            { name: 'Potassium', value: '2.5', unit: 'mmol/L', normal: '3.5-5.0', critical: true },
            { name: 'Sodium', value: '138', unit: 'mmol/L', normal: '135-145', critical: false },
            { name: 'Chloride', value: '102', unit: 'mmol/L', normal: '96-106', critical: false },
          ].map((lab) => (
            <div key={lab.name} className={`p-3 rounded-xl ${lab.critical ? 'bg-red-500/20 border border-red-500/30' : 'bg-gray-100/50 dark:bg-gray-700/50'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`font-semibold ${lab.critical ? 'text-red-700 dark:text-red-300' : 'text-gray-900 dark:text-white'}`}>
                    {lab.name}
                  </p>
                  <p className="text-xs text-gray-500">Normal: {lab.normal}</p>
                </div>
                <div className="text-right">
                  <p className={`text-xl font-bold ${lab.critical ? 'text-red-600' : 'text-gray-900 dark:text-white'}`}>
                    {lab.value}
                  </p>
                  <p className="text-xs text-gray-500">{lab.unit}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
          Collected: Today 07:15 AM · Resulted: 08:42 AM
        </p>
      </GlassCard>

      {/* Clinical Decision Support */}
      <GlassCard className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="text-amber-600" size={20} />
          <h4 className="font-semibold text-gray-900 dark:text-white">AI Recommendations</h4>
        </div>
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5"></div>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Severe hypokalemia detected. Consider immediate IV potassium replacement.
            </p>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-500 mt-1.5"></div>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Monitor for cardiac arrhythmias. ECG recommended.
            </p>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5"></div>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Review current diuretic medications.
            </p>
          </div>
        </div>
      </GlassCard>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button className="py-3 px-4 rounded-xl bg-white/50 dark:bg-gray-800/50 backdrop-blur border border-white/20 font-semibold text-sm">
          <MessageCircle size={16} className="inline mr-2" />
          Consult
        </button>
        <button className="py-3 px-4 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-600 text-white font-semibold shadow-lg text-sm">
          <Send size={16} className="inline mr-2" />
          Order Treatment
        </button>
      </div>

      <button className="w-full py-3 rounded-xl bg-red-500/20 border border-red-500/30 text-red-700 dark:text-red-300 font-semibold">
        Acknowledge Critical Result
      </button>
    </div>
  );

  const journeys = {
    'vital-entry': { name: 'Vital Signs Entry', component: VitalEntryJourney, steps: 3 },
    'medication': { name: 'Medication Admin', component: MedicationJourney, steps: 3 },
    'lab-result': { name: 'Critical Lab Alert', component: LabResultJourney, steps: 1 }
  };

  const CurrentJourney = journeys[currentJourney].component;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-purple-900/20 dark:to-gray-900 p-4">
      <div className="max-w-md mx-auto">
        {/* Journey Selector */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">User Journey Flows</h1>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(journeys).map(([key, journey]) => (
              <button
                key={key}
                onClick={() => {
                  setCurrentJourney(key);
                  setJourneyStep(0);
                }}
                className={`py-3 px-2 rounded-xl text-xs font-semibold transition-all ${
                  currentJourney === key
                    ? 'bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-lg'
                    : 'backdrop-blur-xl bg-white/70 dark:bg-gray-800/70 border border-white/20 text-gray-700 dark:text-gray-300'
                }`}
              >
                {journey.name}
              </button>
            ))}
          </div>
        </div>

        {/* Phone Frame */}
        <div className="relative">
          {/* Status Bar */}
          <div className="bg-gray-900 rounded-t-[2.5rem] px-6 pt-3 pb-2">
            <div className="flex items-center justify-between text-white text-xs">
              <span>9:41</span>
              <div className="flex items-center gap-1">
                <div className="w-4 h-3 border border-white rounded-sm" />
                <div className="w-2 h-3 bg-white rounded-sm" />
              </div>
            </div>
          </div>

          {/* App Content */}
          <div className="bg-gradient-to-br from-purple-100/30 via-pink-100/30 to-blue-100/30 dark:from-gray-800/30 dark:via-purple-800/20 dark:to-gray-800/30 px-4 pt-6 pb-6 min-h-[700px]">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <button 
                onClick={() => journeyStep > 0 && setJourneyStep(journeyStep - 1)}
                className={`p-2 rounded-xl ${journeyStep > 0 ? 'bg-white/50 dark:bg-gray-800/50 backdrop-blur' : 'opacity-0'}`}
              >
                <ArrowLeft size={20} className="text-gray-700 dark:text-gray-300" />
              </button>
              <div className="flex gap-1">
                {[...Array(journeys[currentJourney].steps)].map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 rounded-full transition-all ${
                      i === journeyStep 
                        ? 'w-8 bg-gradient-to-r from-purple-500 to-indigo-600' 
                        : 'w-1.5 bg-gray-300 dark:bg-gray-600'
                    }`}
                  />
                ))}
              </div>
              <div className="w-10" />
            </div>

            {/* Journey Content */}
            <CurrentJourney />
          </div>

          {/* Navigation */}
          {journeys[currentJourney].steps > 1 && (
            <div className="absolute bottom-0 left-0 right-0 backdrop-blur-xl bg-white/80 dark:bg-gray-800/80 rounded-b-[2.5rem] border-t border-white/20 shadow-2xl p-4">
              {journeyStep < journeys[currentJourney].steps - 1 ? (
                <button 
                  onClick={() => setJourneyStep(journeyStep + 1)}
                  className="w-full py-4 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-semibold shadow-lg"
                >
                  Continue
                </button>
              ) : (
                <button 
                  onClick={() => setJourneyStep(0)}
                  className="w-full py-4 rounded-xl bg-white/50 dark:bg-gray-800/50 backdrop-blur border border-white/20 font-semibold"
                >
                  Start Over
                </button>
              )}
              <div className="flex justify-center mt-2">
                <div className="w-32 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MediCoreUserJourneys;
