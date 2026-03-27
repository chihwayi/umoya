import React, { useState, useCallback, useRef } from 'react';
import { Users, ScanLine, CheckCircle, AlertTriangle, Upload, ChevronRight } from 'lucide-react';
import { ehrAxios } from '../services/api';

interface PhoneticMatch {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  similarity: number;
}

interface OcrResult {
  memberId: string | null;
  groupNumber: string | null;
  planName: string | null;
  payerName: string | null;
  effectiveDate: string | null;
  confidence: number;
}

interface SdohQuestion {
  id: string;
  text: string;
  options: string[];
}

// Step 1: Patient Details — with phonetic duplicate check
export const PatientDetailsStep: React.FC<{
  onNext: (data: Record<string, string>) => void;
}> = ({ onNext }) => {
  const [form, setForm] = useState({ firstName: '', lastName: '', dob: '', phone: '' });
  const [matches, setMatches] = useState<PhoneticMatch[]>([]);
  const [checking, setChecking] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const checkDuplicates = useCallback((first: string, last: string, dob: string) => {
    if (!first || !last) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setChecking(true);
      try {
        const res = await ehrAxios.get('/registration/match/phonetic', {
          params: { firstName: first, lastName: last, dob },
        });
        setMatches((res.data as any).matches ?? []);
        setDismissed(false);
      } catch {}
      finally { setChecking(false); }
    }, 600);
  }, []);

  const handleChange = (field: string, value: string) => {
    const next = { ...form, [field]: value };
    setForm(next);
    if (field === 'firstName' || field === 'lastName' || field === 'dob') {
      checkDuplicates(next.firstName, next.lastName, next.dob);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Users className="h-5 w-5 text-blue-600" />
        <h3 className="font-semibold text-gray-800">Patient Details</h3>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {[
          { field: 'firstName', label: 'First Name' },
          { field: 'lastName', label: 'Last Name' },
          { field: 'dob', label: 'Date of Birth', type: 'date' },
          { field: 'phone', label: 'Phone Number' },
        ].map(({ field, label, type }) => (
          <div key={field}>
            <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
            <input
              type={type ?? 'text'}
              value={(form as any)[field]}
              onChange={(e) => handleChange(field, e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>
        ))}
      </div>

      {matches.length > 0 && !dismissed && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <p className="font-semibold text-amber-800">
              {matches.length} possible duplicate patient{matches.length > 1 ? 's' : ''} found
            </p>
          </div>
          <ul className="space-y-2 mb-3">
            {matches.map((m) => (
              <li key={m.id} className="flex items-center justify-between text-sm bg-white rounded p-2 border border-amber-200">
                <div>
                  <span className="font-medium">{m.firstName} {m.lastName}</span>
                  <span className="text-gray-500 ml-2">DOB: {m.dateOfBirth}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-amber-700 font-medium">
                    {Math.round(m.similarity * 100)}% match
                  </span>
                  <button
                    onClick={() => window.open(`/patients/${m.id}`, '_blank')}
                    className="text-xs text-blue-600 underline"
                  >
                    View patient
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <button
            onClick={() => setDismissed(true)}
            className="px-3 py-1.5 text-sm bg-amber-600 text-white rounded hover:bg-amber-700"
          >
            Not a duplicate — continue registration
          </button>
        </div>
      )}

      {checking && (
        <p className="text-xs text-gray-400">Checking for existing patients...</p>
      )}

      <button
        onClick={() => onNext(form)}
        disabled={!form.firstName || !form.lastName || (matches.length > 0 && !dismissed)}
        className="w-full py-2 bg-blue-600 text-white rounded-lg font-medium disabled:opacity-40 hover:bg-blue-700"
      >
        Continue <ChevronRight className="inline h-4 w-4" />
      </button>
    </div>
  );
};


// Step 2: Insurance Card OCR
export const InsuranceCardStep: React.FC<{
  sessionToken: string;
  onNext: (data: Partial<OcrResult>) => void;
}> = ({ sessionToken, onNext }) => {
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<OcrResult | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    setScanning(true);
    const form = new FormData();
    form.append('card', file);
    form.append('sessionToken', sessionToken);
    try {
      const res = await ehrAxios.post('/registration/ocr-insurance-card', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(res.data as OcrResult);
    } catch {
      setManualMode(true);
    } finally {
      setScanning(false);
    }
  };

  if (manualMode || (result && result.confidence < 0.5)) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          {result ? 'Low confidence scan. ' : ''}Please enter insurance details manually.
        </p>
        <button
          onClick={() => onNext(result ?? {})}
          className="w-full py-2 bg-blue-600 text-white rounded-lg"
        >
          Continue with manual entry
        </button>
      </div>
    );
  }

  if (result) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded p-3">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <span className="text-green-800 font-medium">
            Insurance card scanned — {Math.round(result.confidence * 100)}% confidence
          </span>
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          {([
            ['Member ID', result.memberId],
            ['Group Number', result.groupNumber],
            ['Plan Name', result.planName],
            ['Payer', result.payerName],
            ['Effective', result.effectiveDate],
          ] as [string, string | null][]).map(([label, value]) => value && (
            <div key={label}>
              <dt className="text-gray-500">{label}</dt>
              <dd className="font-medium text-gray-900">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="flex gap-2">
          <button
            onClick={() => onNext(result)}
            className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-medium"
          >
            Confirm and continue
          </button>
          <button
            onClick={() => setResult(null)}
            className="px-4 py-2 border rounded-lg text-sm"
          >
            Re-scan
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div
        className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-400 transition-colors"
        onClick={() => fileRef.current?.click()}
      >
        {scanning ? (
          <div className="space-y-2">
            <ScanLine className="h-8 w-8 text-blue-500 mx-auto animate-pulse" />
            <p className="text-sm text-gray-600">Reading insurance card...</p>
          </div>
        ) : (
          <div className="space-y-2">
            <Upload className="h-8 w-8 text-gray-400 mx-auto" />
            <p className="text-sm font-medium text-gray-700">Upload insurance card photo</p>
            <p className="text-xs text-gray-400">Front side. JPG or PNG.</p>
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
        />
      </div>
      <button
        onClick={() => setManualMode(true)}
        className="w-full py-2 border rounded-lg text-sm text-gray-600"
      >
        Skip — enter manually
      </button>
    </div>
  );
};


// Step 3: SDOH Screening
export const SdohScreeningStep: React.FC<{
  patientId: string;
  onComplete: (result: { riskFactors: string[]; overallRiskLevel: string }) => void;
}> = ({ patientId, onComplete }) => {
  const [questions, setQuestions] = React.useState<SdohQuestion[]>([]);
  const [answers, setAnswers] = React.useState<Record<string, number>>({});
  const [submitting, setSubmitting] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    ehrAxios.get('/registration/sdoh-questions')
      .then((res) => setQuestions((res.data as any).questions ?? []))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await ehrAxios.post('/registration/sdoh-score', { patientId, answers });
      onComplete({ riskFactors: (res.data as any).riskFactors, overallRiskLevel: (res.data as any).overallRiskLevel });
    } finally {
      setSubmitting(false);
    }
  };

  const allAnswered = questions.every((q) => answers[q.id] !== undefined);

  if (loading) return <p className="text-sm text-gray-400">Loading questionnaire...</p>;

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-800">
        This brief health questionnaire helps us connect you with community resources.
        All responses are confidential.
      </div>

      {questions.map((q, idx) => (
        <div key={q.id} className="space-y-2">
          <p className="text-sm font-medium text-gray-800">
            {idx + 1}. {q.text}
          </p>
          <div className="space-y-1">
            {q.options.map((option, optIdx) => (
              <label key={optIdx} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name={q.id}
                  value={optIdx}
                  checked={answers[q.id] === optIdx}
                  onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: optIdx }))}
                  className="text-blue-600"
                />
                <span className="text-sm text-gray-700">{option}</span>
              </label>
            ))}
          </div>
        </div>
      ))}

      <button
        onClick={handleSubmit}
        disabled={!allAnswered || submitting}
        className="w-full py-2 bg-blue-600 text-white rounded-lg font-medium disabled:opacity-40"
      >
        {submitting ? 'Submitting...' : 'Complete registration'}
      </button>
    </div>
  );
};
