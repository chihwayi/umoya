import React, { useEffect, useState } from 'react';
import { api } from '../services/api';

interface Applicant {
  id: string;
  patient_id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  licence_type: string;
  class_required: string;
  caaz_licence_number: string | null;
  next_medical_due: string | null;
}

interface ExpiringCert {
  id: string;
  cert_number: string;
  cert_class: string;
  expiry_date: string;
  days_to_expiry: number;
  first_name: string;
  last_name: string;
  licence_type: string;
}

const LICENCE_CHIP: Record<string, string> = {
  atpl: 'bg-teal-500/20 text-teal-300',
  cpl:  'bg-blue-500/20 text-blue-300',
  ppl:  'bg-amber-500/20 text-amber-300',
  lapl: 'bg-yellow-500/20 text-yellow-300',
  atco: 'bg-purple-500/20 text-purple-300',
  student: 'bg-slate-500/20 text-slate-300',
};

const CLASS_LABEL: Record<string, string> = {
  class1: 'Class 1',
  class2: 'Class 2',
  class3: 'Class 3',
};

export default function AviationMedicineDashboard() {
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [expiring, setExpiring] = useState<ExpiringCert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/aviation/applicants'),
      api.get('/aviation/certificates/expiring-soon'),
    ]).then(([a, e]: any[]) => {
      setApplicants(Array.isArray(a) ? a : a.data ?? []);
      setExpiring(Array.isArray(e) ? e : e.data ?? []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        Loading Aviation Medicine…
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <span className="text-3xl">✈</span>
        <div>
          <h1 className="text-2xl font-bold text-white">Aviation Medicine</h1>
          <p className="text-sm text-slate-400">CAAZ / ICAO Annex 1 — Class 1 & 2 Medical Examinations</p>
        </div>
      </div>

      {/* Expiring certificates alert queue */}
      {expiring.length > 0 && (
        <div className="bg-amber-900/30 border border-amber-500/40 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-amber-300 mb-3">
            ⚠ Certificates Expiring Within 60 Days ({expiring.length})
          </h2>
          <div className="space-y-2">
            {expiring.map(cert => (
              <div key={cert.id} className="flex items-center justify-between bg-slate-800/60 rounded-lg px-4 py-2">
                <div>
                  <span className="text-white text-sm font-medium">{cert.first_name} {cert.last_name}</span>
                  <span className="ml-2 text-xs text-slate-400 uppercase">{cert.licence_type}</span>
                </div>
                <div className="text-right">
                  <div className="text-xs text-amber-300 font-mono">{cert.cert_number}</div>
                  <div className="text-xs text-slate-400">{CLASS_LABEL[cert.cert_class] ?? cert.cert_class} — expires {cert.expiry_date} ({cert.days_to_expiry}d)</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <div className="text-3xl font-bold text-teal-400">{applicants.length}</div>
          <div className="text-xs text-slate-400 mt-1">Registered Applicants</div>
        </div>
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <div className="text-3xl font-bold text-amber-400">{expiring.length}</div>
          <div className="text-xs text-slate-400 mt-1">Certs Expiring ≤60d</div>
        </div>
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <div className="text-3xl font-bold text-blue-400">
            {applicants.filter(a => a.class_required === 'class1').length}
          </div>
          <div className="text-xs text-slate-400 mt-1">Class 1 Applicants</div>
        </div>
      </div>

      {/* Applicant list */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Applicant Register</h2>
          <span className="text-xs text-slate-400">{applicants.length} active</span>
        </div>
        {applicants.length === 0 ? (
          <div className="px-4 py-8 text-center text-slate-500 text-sm">No applicants registered yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-400 border-b border-slate-700">
                <th className="text-left px-4 py-2">Applicant</th>
                <th className="text-left px-4 py-2">Licence</th>
                <th className="text-left px-4 py-2">Class</th>
                <th className="text-left px-4 py-2">CAAZ #</th>
                <th className="text-left px-4 py-2">Next Medical</th>
              </tr>
            </thead>
            <tbody>
              {applicants.map(a => {
                const due = a.next_medical_due ? new Date(a.next_medical_due) : null;
                const overdue = due && due < new Date();
                const daysLeft = due ? Math.ceil((due.getTime() - Date.now()) / 86400000) : null;
                return (
                  <tr key={a.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-3 text-white font-medium">{a.last_name}, {a.first_name}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-mono uppercase ${LICENCE_CHIP[a.licence_type] ?? 'bg-slate-600 text-slate-300'}`}>
                        {a.licence_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{CLASS_LABEL[a.class_required] ?? a.class_required}</td>
                    <td className="px-4 py-3 text-slate-400 font-mono text-xs">{a.caaz_licence_number ?? '—'}</td>
                    <td className="px-4 py-3">
                      {due ? (
                        <span className={`text-xs font-medium ${overdue ? 'text-red-400' : daysLeft! <= 60 ? 'text-amber-400' : 'text-emerald-400'}`}>
                          {a.next_medical_due} {overdue ? '(OVERDUE)' : daysLeft !== null ? `(${daysLeft}d)` : ''}
                        </span>
                      ) : (
                        <span className="text-slate-500 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Examination form placeholder */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
        <h2 className="text-sm font-semibold text-white mb-4">Medical Examination Form</h2>
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Vision', icon: '👁', hint: 'Distant VA, near VA, colour vision' },
            { label: 'Hearing', icon: '👂', hint: 'Audiometry 250–4000 Hz bilateral' },
            { label: 'Cardiovascular', icon: '❤', hint: 'BP ≤160/95, resting HR, ECG' },
            { label: 'Respiratory', icon: '🫁', hint: 'FEV1%, FVC%, spirometry' },
            { label: 'Neurological', icon: '🧠', hint: 'No seizure history, no focal deficit' },
            { label: 'Psychiatric', icon: '🧩', hint: 'No psychosis, no substance use' },
          ].map(sec => (
            <div key={sec.label} className="bg-slate-700/40 rounded-lg p-4 border border-slate-600/40">
              <div className="flex items-center gap-2 mb-1">
                <span>{sec.icon}</span>
                <span className="text-sm font-medium text-white">{sec.label}</span>
                <span className="ml-auto w-2 h-2 rounded-full bg-slate-500" />
              </div>
              <p className="text-xs text-slate-500">{sec.hint}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-slate-500">Select an applicant to begin a structured examination.</p>
      </div>
    </div>
  );
}
