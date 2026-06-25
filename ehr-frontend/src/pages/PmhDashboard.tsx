import React, { useEffect, useState } from 'react';
import { api } from '../services/api';

const RISK_COLORS: Record<string, string> = {
  critical: '#FF4444',
  high:     '#FF6B35',
  moderate: '#F5A623',
  low:      '#27AE60',
  immediate:'#FF4444',
};

const EPDS_QUESTIONS = [
  { key: 'q1',  text: 'I have been able to laugh and see the funny side of things.' },
  { key: 'q2',  text: 'I have looked forward with enjoyment to things.' },
  { key: 'q3',  text: 'I have blamed myself unnecessarily when things went wrong.' },
  { key: 'q4',  text: 'I have been anxious or worried for no good reason.' },
  { key: 'q5',  text: 'I have felt scared or panicky for no very good reason.' },
  { key: 'q6',  text: 'Things have been getting on top of me.' },
  { key: 'q7',  text: 'I have been so unhappy that I have had difficulty sleeping.' },
  { key: 'q8',  text: 'I have felt sad or miserable.' },
  { key: 'q9',  text: 'I have been so unhappy that I have been crying.' },
  { key: 'q10', text: 'The thought of harming myself has occurred to me.' },
];

const Q_OPTIONS = ['0 — Never / Not at all', '1 — Occasionally', '2 — Sometimes', '3 — Most of the time'];

export default function PmhDashboard() {
  const [criticalQueue, setCriticalQueue] = useState<any[]>([]);
  const [overdueFollowups, setOverdueFollowups] = useState<any[]>([]);
  const [tab, setTab] = useState<'critical' | 'epds' | 'safeguarding'>('critical');
  const [epdsScores, setEpdsScores] = useState<Record<string, number>>({});
  const [epdsResult, setEpdsResult] = useState<any>(null);
  const [epdsPatientId, setEpdsPatientId] = useState('');
  const [epdsAssessmentId, setEpdsAssessmentId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [safeguardingFlags, setSafeguardingFlags] = useState<any[]>([]);
  const [sfPatientId, setSfPatientId] = useState('');

  useEffect(() => { loadCritical(); loadOverdue(); }, []);

  async function loadCritical() {
    try { const r: any = await api.get('/pmh/epds/critical-queue'); setCriticalQueue(r.data ?? []); } catch {}
  }
  async function loadOverdue() {
    try { const r: any = await api.get('/pmh/followup/overdue'); setOverdueFollowups(r.data ?? []); } catch {}
  }

  async function submitEpds() {
    if (Object.keys(epdsScores).length < 10) return alert('Answer all 10 questions.');
    setSubmitting(true);
    try {
      const payload = {
        assessmentId: epdsAssessmentId,
        patientId: epdsPatientId,
        ...Object.fromEntries(EPDS_QUESTIONS.map(q => [q.key, epdsScores[q.key] ?? 0])),
      };
      const r: any = await api.post('/pmh/epds', payload);
      setEpdsResult(r.data ?? r);
      if ((r.data ?? r).risk_level === 'critical') loadCritical();
    } catch { alert('Submission failed.'); }
    finally { setSubmitting(false); }
  }

  async function markReviewed(id: string) {
    try { await api.patch(`/pmh/epds/${id}/reviewed`); loadCritical(); } catch {}
  }

  async function loadSafeguarding() {
    if (!sfPatientId) return;
    try { const r: any = await api.get(`/pmh/safeguarding/${sfPatientId}`); setSafeguardingFlags(r.data ?? []); } catch {}
  }

  const totalEpds = Object.values(epdsScores).reduce((a, b) => a + b, 0);

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', background: '#0F1117', minHeight: '100vh', color: '#E8EAF0', padding: 24 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Perinatal Mental Health</h1>
      <p style={{ color: '#8B90A0', fontSize: 13, marginBottom: 20 }}>EPDS Screening · Safeguarding · Follow-up</p>

      {/* Critical Banner */}
      {criticalQueue.length > 0 && (
        <div style={{ background: '#FF444422', border: '1px solid #FF4444', borderRadius: 10, padding: '12px 16px', marginBottom: 20 }}>
          <span style={{ color: '#FF4444', fontWeight: 700, fontSize: 14 }}>
            CRITICAL — {criticalQueue.length} unreviewed Q10≥1 case{criticalQueue.length > 1 ? 's' : ''}. Immediate action required.
          </span>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {(['critical', 'epds', 'safeguarding'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 18px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            background: tab === t ? '#00BFA5' : '#1E2130', color: tab === t ? '#0F1117' : '#8B90A0',
          }}>
            {t === 'critical' ? `Critical Queue (${criticalQueue.length})` : t === 'epds' ? 'EPDS Form' : 'Safeguarding'}
          </button>
        ))}
      </div>

      {/* Critical Queue Tab */}
      {tab === 'critical' && (
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: '#B0B8C8' }}>Unreviewed Critical Cases</h2>
          {criticalQueue.length === 0 && (
            <div style={{ background: '#1E2130', borderRadius: 10, padding: 24, textAlign: 'center', color: '#8B90A0' }}>
              No critical cases pending review.
            </div>
          )}
          {criticalQueue.map((c: any) => (
            <div key={c.id} style={{ background: '#1E2130', borderRadius: 10, padding: 16, marginBottom: 10, borderLeft: '4px solid #FF4444' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ fontWeight: 700, fontSize: 15, margin: 0 }}>{c.first_name} {c.last_name}</p>
                  <p style={{ color: '#8B90A0', fontSize: 12, margin: '4px 0' }}>EPDS Score: {c.total_score} | Q10: {c.q10_score} | {new Date(c.created_at).toLocaleString()}</p>
                  <p style={{ color: '#FF4444', fontSize: 12, margin: 0 }}>Self-harm ideation confirmed — do not leave patient alone</p>
                </div>
                <button onClick={() => markReviewed(c.id)} style={{
                  background: '#00BFA5', color: '#0F1117', border: 'none', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontWeight: 600, fontSize: 12,
                }}>Mark Reviewed</button>
              </div>
            </div>
          ))}

          <h2 style={{ fontSize: 15, fontWeight: 600, margin: '24px 0 12px', color: '#B0B8C8' }}>Overdue Follow-ups</h2>
          {overdueFollowups.length === 0 && (
            <div style={{ background: '#1E2130', borderRadius: 10, padding: 24, textAlign: 'center', color: '#8B90A0' }}>No overdue follow-ups.</div>
          )}
          {overdueFollowups.map((f: any) => (
            <div key={f.id} style={{ background: '#1E2130', borderRadius: 10, padding: 14, marginBottom: 8, borderLeft: '4px solid #F5A623' }}>
              <p style={{ fontWeight: 600, margin: 0 }}>{f.first_name} {f.last_name}</p>
              <p style={{ color: '#8B90A0', fontSize: 12, margin: '4px 0 0' }}>Due: {f.due_date} · {f.assessment_timing}</p>
            </div>
          ))}
        </div>
      )}

      {/* EPDS Form Tab */}
      {tab === 'epds' && (
        <div style={{ maxWidth: 640 }}>
          {epdsResult ? (
            <div style={{ background: '#1E2130', borderRadius: 12, padding: 24, borderLeft: `4px solid ${RISK_COLORS[epdsResult.cdss_risk_level] ?? '#00BFA5'}` }}>
              <p style={{ fontSize: 36, fontWeight: 700, color: RISK_COLORS[epdsResult.cdss_risk_level], margin: 0 }}>{epdsResult.total_score} / 30</p>
              <p style={{ fontWeight: 700, color: RISK_COLORS[epdsResult.cdss_risk_level], fontSize: 14, margin: '4px 0 12px' }}>
                {epdsResult.risk_level?.toUpperCase()}
              </p>
              <p style={{ color: '#E8EAF0', fontSize: 13, lineHeight: 1.6 }}>{epdsResult.cdss_alert}</p>
              <button onClick={() => { setEpdsResult(null); setEpdsScores({}); }} style={{
                marginTop: 16, background: '#1E2130', border: '1px solid #2A2F42', color: '#8B90A0', borderRadius: 8, padding: '8px 16px', cursor: 'pointer',
              }}>New Assessment</button>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                <input placeholder="Patient ID" value={epdsPatientId} onChange={e => setEpdsPatientId(e.target.value)}
                  style={{ flex: 1, background: '#1E2130', border: '1px solid #2A2F42', borderRadius: 8, padding: '8px 12px', color: '#E8EAF0', fontSize: 13 }} />
                <input placeholder="Assessment ID" value={epdsAssessmentId} onChange={e => setEpdsAssessmentId(e.target.value)}
                  style={{ flex: 1, background: '#1E2130', border: '1px solid #2A2F42', borderRadius: 8, padding: '8px 12px', color: '#E8EAF0', fontSize: 13 }} />
              </div>
              <div style={{ background: '#1E2130', borderRadius: 8, padding: '8px 14px', marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#8B90A0', fontSize: 13 }}>Running Total</span>
                <span style={{ fontWeight: 700, fontSize: 18, color: totalEpds >= 13 ? '#FF6B35' : totalEpds >= 10 ? '#F5A623' : '#00BFA5' }}>{totalEpds} / 30</span>
              </div>

              {EPDS_QUESTIONS.map((q, qi) => (
                <div key={q.key} style={{ background: '#1E2130', borderRadius: 10, padding: 14, marginBottom: 10 }}>
                  <p style={{ fontWeight: 600, fontSize: 13, margin: '0 0 10px' }}>{qi + 1}. {q.text}</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {Q_OPTIONS.map((opt, oi) => (
                      <label key={oi} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '6px 10px', borderRadius: 6,
                        background: epdsScores[q.key] === oi ? '#00BFA522' : 'transparent' }}>
                        <input type="radio" name={q.key} value={oi} checked={epdsScores[q.key] === oi}
                          onChange={() => setEpdsScores(prev => ({ ...prev, [q.key]: oi }))} style={{ accentColor: '#00BFA5' }} />
                        <span style={{ fontSize: 13, color: epdsScores[q.key] === oi ? '#00BFA5' : '#8B90A0' }}>{opt}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}

              <button onClick={submitEpds} disabled={submitting || Object.keys(epdsScores).length < 10 || !epdsPatientId || !epdsAssessmentId}
                style={{ width: '100%', background: '#00BFA5', color: '#0F1117', border: 'none', borderRadius: 10, padding: 14, fontWeight: 700, fontSize: 15, cursor: 'pointer',
                  opacity: (submitting || Object.keys(epdsScores).length < 10 || !epdsPatientId || !epdsAssessmentId) ? 0.5 : 1 }}>
                {submitting ? 'Submitting…' : 'Submit EPDS'}
              </button>
            </>
          )}
        </div>
      )}

      {/* Safeguarding Tab */}
      {tab === 'safeguarding' && (
        <div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <input placeholder="Patient ID" value={sfPatientId} onChange={e => setSfPatientId(e.target.value)}
              style={{ flex: 1, background: '#1E2130', border: '1px solid #2A2F42', borderRadius: 8, padding: '8px 12px', color: '#E8EAF0', fontSize: 13 }} />
            <button onClick={loadSafeguarding} style={{ background: '#00BFA5', color: '#0F1117', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontWeight: 600 }}>
              Load
            </button>
          </div>

          {safeguardingFlags.length === 0 && sfPatientId && (
            <div style={{ background: '#1E2130', borderRadius: 10, padding: 24, textAlign: 'center', color: '#8B90A0' }}>No safeguarding flags for this patient.</div>
          )}

          {safeguardingFlags.map((f: any) => (
            <div key={f.id} style={{ background: '#1E2130', borderRadius: 10, padding: 16, marginBottom: 10, borderLeft: `4px solid ${RISK_COLORS[f.risk_level] ?? '#00BFA5'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 700, color: RISK_COLORS[f.risk_level], fontSize: 13 }}>{f.risk_level?.toUpperCase()}</span>
                <span style={{ color: '#8B90A0', fontSize: 12 }}>{f.flag_date}</span>
              </div>
              {f.referred_to && <p style={{ color: '#B0B8C8', fontSize: 12, margin: '6px 0 0' }}>Referred to: {f.referred_to}</p>}
              {f.notes && <p style={{ color: '#8B90A0', fontSize: 12, margin: '4px 0 0' }}>{f.notes}</p>}
              {f.child_protection_plan && (
                <span style={{ display: 'inline-block', background: '#FF444422', color: '#FF4444', borderRadius: 4, padding: '2px 8px', fontSize: 11, marginTop: 6 }}>
                  Child Protection Plan Active
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
