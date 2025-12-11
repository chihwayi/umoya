/**
 * Patient Consent Modal for Voice Recording
 */

import React, { useState } from 'react';
import { X, Mic } from 'lucide-react';

interface ConsentModalProps {
  visible: boolean;
  patientName?: string;
  onConsent: () => void;
  onDecline: () => void;
}

const ConsentModal: React.FC<ConsentModalProps> = ({
  visible,
  patientName,
  onConsent,
  onDecline,
}) => {
  const [acknowledged, setAcknowledged] = useState(false);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white bg-opacity-20 p-3 rounded-xl">
              <Mic className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white">Voice Recording Consent</h2>
          </div>
          <button
            onClick={onDecline}
            className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {patientName && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-indigo-900">Patient: {patientName}</p>
            </div>
          )}

          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">What is being recorded?</h3>
            <p className="text-slate-700 mb-3">
              This consultation will be audio recorded to help your doctor document your visit more accurately. The recording will be used to:
            </p>
            <ul className="list-disc list-inside space-y-2 text-slate-700 ml-4">
              <li>Transcribe the conversation into medical notes</li>
              <li>Extract important information (symptoms, vitals, medications)</li>
              <li>Improve documentation accuracy</li>
            </ul>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Privacy & Security</h3>
            <ul className="space-y-2 text-slate-700">
              <li>• Recordings are encrypted and stored securely</li>
              <li>• Only authorized medical staff can access recordings</li>
              <li>• Recordings are deleted after transcription (unless you consent to retention)</li>
              <li>• Your privacy is protected under HIPAA/GDPR regulations</li>
            </ul>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Your Rights</h3>
            <ul className="space-y-2 text-slate-700">
              <li>• You can decline recording at any time</li>
              <li>• You can request deletion of recordings</li>
              <li>• You can review and correct extracted information</li>
              <li>• Manual documentation is always available as an alternative</li>
            </ul>
          </div>

          {/* Consent Checkbox */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                className="mt-1 w-5 h-5 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
              />
              <span className="text-slate-700 flex-1">
                I understand and consent to audio recording of this consultation
              </span>
            </label>
          </div>
        </div>

        {/* Actions */}
        <div className="border-t border-slate-200 p-6 flex gap-3">
          <button
            onClick={onDecline}
            className="flex-1 px-6 py-3 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors font-medium"
          >
            Decline
          </button>
          <button
            onClick={onConsent}
            disabled={!acknowledged}
            className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Mic className="w-4 h-4" />
            I Consent
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConsentModal;
