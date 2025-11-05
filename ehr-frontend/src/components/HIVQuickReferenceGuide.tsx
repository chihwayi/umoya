import React from 'react';
import { X, Book, Pill, Calendar, Activity, Stethoscope } from 'lucide-react';

interface HIVQuickReferenceGuideProps {
  onClose: () => void;
}

const HIVQuickReferenceGuide: React.FC<HIVQuickReferenceGuideProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Book className="w-6 h-6" />
            <h2 className="text-xl font-bold">HIV Care Quick Reference Guide</h2>
          </div>
          <button onClick={onClose} className="text-white hover:text-emerald-100">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* ARV Status Codes */}
            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
              <div className="flex items-center gap-2 mb-3">
                <Pill className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-slate-900">ARV Status Codes</h3>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="font-semibold">1</span>
                  <span>No ARV</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">2 / 2a</span>
                  <span>Start ARV</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">2b</span>
                  <span>Start ARV (after re-test)</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">3</span>
                  <span>Continue</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">4</span>
                  <span>Change (requires doctor approval)</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">5</span>
                  <span>Stop</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">6</span>
                  <span>Restart</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">7</span>
                  <span>PMTCT</span>
                </div>
              </div>
            </div>

            {/* Visit Types */}
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-900">Visit Types</h3>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="font-semibold">A</span>
                  <span>Present Self (Conventional Care)</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">B</span>
                  <span>Sent Care Giver/Treatment Supporter</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">C</span>
                  <span>Visit at Another Clinic</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">D</span>
                  <span>Community ART Refill Group (CARG)</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">E</span>
                  <span>Group Facility Pick-up</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">F</span>
                  <span>Individual Pick-up from Pharmacy</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">G</span>
                  <span>Individual Pick-up via Mobile Outreach</span>
                </div>
              </div>
            </div>

            {/* WHO Clinical Stages */}
            <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
              <div className="flex items-center gap-2 mb-3">
                <Stethoscope className="w-5 h-5 text-purple-600" />
                <h3 className="font-bold text-slate-900">WHO Clinical Stages</h3>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="font-semibold">Stage 1</span>
                  <span>Asymptomatic</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">Stage 2</span>
                  <span>Mild symptoms</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">Stage 3</span>
                  <span>Advanced symptoms</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">Stage 4</span>
                  <span>Severe symptoms (AIDS)</span>
                </div>
              </div>
            </div>

            {/* Functional Status */}
            <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
              <div className="flex items-center gap-2 mb-3">
                <Activity className="w-5 h-5 text-amber-600" />
                <h3 className="font-bold text-slate-900">Functional Status</h3>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="font-semibold">W</span>
                  <span>Working / Normal activity</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">A</span>
                  <span>Ambulatory / Reduced activity</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">B</span>
                  <span>Bedridden / Unable to work</span>
                </div>
              </div>
            </div>

            {/* TB Screening */}
            <div className="bg-red-50 rounded-lg p-4 border border-red-200">
              <h3 className="font-bold text-slate-900 mb-3">TB Screening</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="font-semibold">Y</span>
                  <span>Yes (TB positive)</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">S</span>
                  <span>Suspected</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">ON</span>
                  <span>On TB Treatment</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">N</span>
                  <span>No (TB negative)</span>
                </div>
              </div>
            </div>

            {/* TPT Status */}
            <div className="bg-teal-50 rounded-lg p-4 border border-teal-200">
              <h3 className="font-bold text-slate-900 mb-3">TPT Status</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="font-semibold">II</span>
                  <span>Initiated</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">CI</span>
                  <span>Completed</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">RI</span>
                  <span>Re-initiated</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">IS</span>
                  <span>Interrupted / Stopped</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">HPI</span>
                  <span>High Priority (for initiation)</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">IC</span>
                  <span>Ineligible</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">INI</span>
                  <span>Not Initiated</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">NE</span>
                  <span>Not Eligible</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">N/A</span>
                  <span>Not Applicable</span>
                </div>
              </div>
            </div>

            {/* Visit Status */}
            <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-200">
              <h3 className="font-bold text-slate-900 mb-3">Visit Status</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="font-semibold">E</span>
                  <span>Early</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">OT</span>
                  <span>On Time</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">L</span>
                  <span>Late</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">D</span>
                  <span>Defaulter</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">LO</span>
                  <span>Lost to Follow-up</span>
                </div>
              </div>
            </div>

            {/* Referrals */}
            <div className="bg-pink-50 rounded-lg p-4 border border-pink-200">
              <h3 className="font-bold text-slate-900 mb-3">Referrals</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="font-semibold">P</span>
                  <span>PMTCT</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">T</span>
                  <span>TB</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">F</span>
                  <span>Family Planning</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">D</span>
                  <span>Dental</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">H</span>
                  <span>Hospital</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">O</span>
                  <span>Other</span>
                </div>
              </div>
            </div>
          </div>

          {/* Important Notes */}
          <div className="mt-6 bg-amber-50 rounded-lg p-4 border border-amber-200">
            <h3 className="font-bold text-slate-900 mb-2">Important Notes</h3>
            <ul className="text-sm text-slate-700 space-y-1 list-disc list-inside">
              <li>ARV Status "4" (Change) requires doctor approval</li>
              <li>Visit types B, D, E, F, G are drug pickups only (no clinical exam)</li>
              <li>TPT eligibility is automatically checked based on TB status</li>
              <li>Next review date = ARV quantity dispensed (1 ARV = 1 day)</li>
              <li>EAC is required for patients with VL &gt; 1000 copies/mL</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HIVQuickReferenceGuide;

