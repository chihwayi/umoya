import React, { useState } from 'react';
import { api } from '../services/api';

interface Props { patientId: string; }

export const RecommendEducationButton: React.FC<Props> = ({ patientId }) => {
  const [open, setOpen] = useState(false);
  const [courseId, setCourseId] = useState('');
  const [note, setNote] = useState('');
  const [courses, setCourses] = useState<any[]>([]);
  const [sent, setSent] = useState(false);

  const openModal = async () => {
    const res = await api.get('/education/courses?limit=50');
    setCourses((res.data as any) ?? []);
    setOpen(true);
  };

  const send = async () => {
    await api.post('/education/clinician/recommend', { patientId, courseId, note });
    setSent(true);
    setTimeout(() => { setOpen(false); setSent(false); }, 1500);
  };

  if (!open) {
    return (
      <button
        onClick={openModal}
        style={{
          padding: '6px 14px', backgroundColor: '#7c3aed', color: 'white',
          border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13,
        }}
      >
        Recommend Education
      </button>
    );
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{ backgroundColor: 'white', padding: 24, borderRadius: 12, width: 400 }}>
        <h3 style={{ marginBottom: 16, fontWeight: 700 }}>Recommend a Course</h3>
        {sent ? (
          <p style={{ color: '#16a34a', fontWeight: 600 }}>Recommendation sent!</p>
        ) : (
          <>
            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              style={{ width: '100%', padding: 8, marginBottom: 12, borderRadius: 6, border: '1px solid #d1d5db' }}
            >
              <option value="">Select a course...</option>
              {courses.map((c: any) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note for the patient (optional)"
              rows={3}
              style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db', marginBottom: 12 }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={send}
                disabled={!courseId}
                style={{
                  flex: 1, padding: 8, backgroundColor: '#7c3aed', color: 'white',
                  border: 'none', borderRadius: 6, cursor: courseId ? 'pointer' : 'not-allowed',
                  opacity: courseId ? 1 : 0.5,
                }}
              >
                Send Recommendation
              </button>
              <button
                onClick={() => setOpen(false)}
                style={{
                  padding: 8, backgroundColor: '#f3f4f6', border: 'none',
                  borderRadius: 6, cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
