import React, { useState } from 'react';
import { X, Activity, Wind, Heart, Brain, Droplets } from 'lucide-react';
import axios from 'axios';
import { useNotification } from './GlobalNotification';

const ehrAxios = axios.create({ baseURL: 'http://localhost:3013/api' });

interface AldreteScoreModalProps {
  pacuRecordId: string;
  currentScore: number;
  tenantSlug: string;
  token: string;
  onSuccess: () => void;
  onClose: () => void;
}

const AldreteScoreModal: React.FC<AldreteScoreModalProps> = ({
  pacuRecordId,
  currentScore,
  tenantSlug,
  token,
  onSuccess,
  onClose,
}) => {
  const { showError } = useNotification();

  const [scores, setScores] = useState({
    activity: 2,
    respiration: 2,
    circulation: 2,
    consciousness: 2,
    o2Saturation: 2,
  });

  const [painScore, setPainScore] = useState(0);

  const totalScore = Object.values(scores).reduce((sum, score) => sum + score, 0);

  const handleSubmit = async () => {
    try {
      await ehrAxios.put(`/anesthesia/pacu/${pacuRecordId}/aldrete`, {
        aldreteScoreDischarge: totalScore,
        aldreteComponents: scores,
        painScoreDischarge: painScore,
      }, {
        headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      });

      onSuccess();
    } catch (error: any) {
      showError('Error', error.response?.data?.message || 'Failed to update Aldrete score');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-violet-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Activity className="w-6 h-6" />
                Aldrete Score Assessment
              </h2>
              <p className="text-purple-100 mt-1">Post-Anesthesia Recovery Score (0-10)</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Total Score Display */}
            <div className={`rounded-xl p-6 text-center border-2 ${
              totalScore >= 9 ? 'bg-green-50 border-green-300' :
              totalScore >= 7 ? 'bg-yellow-50 border-yellow-300' :
              'bg-red-50 border-red-300'
            }`}>
              <p className="text-sm text-slate-600 mb-2">Total Aldrete Score</p>
              <p className={`text-6xl font-bold ${
                totalScore >= 9 ? 'text-green-600' :
                totalScore >= 7 ? 'text-yellow-600' :
                'text-red-600'
              }`}>{totalScore}/10</p>
              <p className="text-sm font-semibold mt-2">
                {totalScore >= 9 ? '✅ Ready for Discharge' :
                 totalScore >= 7 ? '⚠️ Continue Monitoring' :
                 '🔴 Not Ready - Close Monitoring Required'}
              </p>
            </div>

            {/* Activity */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
              <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                <Activity className="w-5 h-5 text-purple-600" />
                Activity (Muscle Movement)
              </h3>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={scores.activity === 2}
                    onChange={() => setScores({ ...scores, activity: 2 })}
                    className="w-4 h-4 text-purple-600"
                  />
                  <span className="text-slate-700">2 - Moves all extremities voluntarily</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={scores.activity === 1}
                    onChange={() => setScores({ ...scores, activity: 1 })}
                    className="w-4 h-4 text-purple-600"
                  />
                  <span className="text-slate-700">1 - Moves 2 extremities voluntarily</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={scores.activity === 0}
                    onChange={() => setScores({ ...scores, activity: 0 })}
                    className="w-4 h-4 text-purple-600"
                  />
                  <span className="text-slate-700">0 - Unable to move extremities</span>
                </label>
              </div>
            </div>

            {/* Respiration */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
              <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                <Wind className="w-5 h-5 text-blue-600" />
                Respiration
              </h3>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={scores.respiration === 2}
                    onChange={() => setScores({ ...scores, respiration: 2 })}
                    className="w-4 h-4 text-purple-600"
                  />
                  <span className="text-slate-700">2 - Breathes deeply, coughs freely</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={scores.respiration === 1}
                    onChange={() => setScores({ ...scores, respiration: 1 })}
                    className="w-4 h-4 text-purple-600"
                  />
                  <span className="text-slate-700">1 - Dyspnea or limited breathing</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={scores.respiration === 0}
                    onChange={() => setScores({ ...scores, respiration: 0 })}
                    className="w-4 h-4 text-purple-600"
                  />
                  <span className="text-slate-700">0 - Apneic</span>
                </label>
              </div>
            </div>

            {/* Circulation */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
              <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                <Heart className="w-5 h-5 text-red-600" />
                Circulation (Blood Pressure)
              </h3>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={scores.circulation === 2}
                    onChange={() => setScores({ ...scores, circulation: 2 })}
                    className="w-4 h-4 text-purple-600"
                  />
                  <span className="text-slate-700">2 - BP ±20% of pre-anesthesia level</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={scores.circulation === 1}
                    onChange={() => setScores({ ...scores, circulation: 1 })}
                    className="w-4 h-4 text-purple-600"
                  />
                  <span className="text-slate-700">1 - BP ±20-50% of pre-anesthesia level</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={scores.circulation === 0}
                    onChange={() => setScores({ ...scores, circulation: 0 })}
                    className="w-4 h-4 text-purple-600"
                  />
                  <span className="text-slate-700">0 - BP ±50% of pre-anesthesia level</span>
                </label>
              </div>
            </div>

            {/* Consciousness */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
              <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                <Brain className="w-5 h-5 text-indigo-600" />
                Consciousness
              </h3>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={scores.consciousness === 2}
                    onChange={() => setScores({ ...scores, consciousness: 2 })}
                    className="w-4 h-4 text-purple-600"
                  />
                  <span className="text-slate-700">2 - Fully awake</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={scores.consciousness === 1}
                    onChange={() => setScores({ ...scores, consciousness: 1 })}
                    className="w-4 h-4 text-purple-600"
                  />
                  <span className="text-slate-700">1 - Arousable on calling</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={scores.consciousness === 0}
                    onChange={() => setScores({ ...scores, consciousness: 0 })}
                    className="w-4 h-4 text-purple-600"
                  />
                  <span className="text-slate-700">0 - Not responding</span>
                </label>
              </div>
            </div>

            {/* O2 Saturation */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
              <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                <Droplets className="w-5 h-5 text-cyan-600" />
                O2 Saturation
              </h3>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={scores.o2Saturation === 2}
                    onChange={() => setScores({ ...scores, o2Saturation: 2 })}
                    className="w-4 h-4 text-purple-600"
                  />
                  <span className="text-slate-700">2 - SpO2 &gt;92% on room air</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={scores.o2Saturation === 1}
                    onChange={() => setScores({ ...scores, o2Saturation: 1 })}
                    className="w-4 h-4 text-purple-600"
                  />
                  <span className="text-slate-700">1 - Needs O2 to maintain SpO2 &gt;90%</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={scores.o2Saturation === 0}
                    onChange={() => setScores({ ...scores, o2Saturation: 0 })}
                    className="w-4 h-4 text-purple-600"
                  />
                  <span className="text-slate-700">0 - SpO2 &lt;90% even with O2</span>
                </label>
              </div>
            </div>

            {/* Pain Score */}
            <div className="bg-red-50 rounded-xl p-4 border border-red-200">
              <h3 className="font-bold text-slate-900 mb-3">Pain Score (0-10)</h3>
              <div className="flex items-center gap-2">
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => (
                  <button
                    key={score}
                    onClick={() => setPainScore(score)}
                    className={`w-10 h-10 rounded-lg font-bold transition-all ${
                      painScore === score
                        ? 'bg-red-600 text-white shadow-lg scale-110'
                        : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    {score}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-4 flex items-center justify-end gap-3 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-slate-200 text-slate-700 rounded-xl hover:bg-slate-300 transition-colors font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-6 py-2 bg-gradient-to-r from-purple-600 to-violet-600 text-white rounded-xl hover:from-purple-700 hover:to-violet-700 transition-all font-semibold"
          >
            Save Score
          </button>
        </div>
      </div>
    </div>
  );
};

export default AldreteScoreModal;

