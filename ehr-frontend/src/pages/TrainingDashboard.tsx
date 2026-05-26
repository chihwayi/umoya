import React, { useEffect, useState } from 'react';
import { ehrApi } from '../services/api';

type TabId = 'courses' | 'trainees' | 'enrolments' | 'alumni';

interface Course {
  id: string;
  course_code: string;
  course_name: string;
  course_type: string;
  duration_days?: number;
  cpd_credits?: number;
  target_audience?: string;
  pass_mark_pct: number;
  accrediting_body?: string;
  modules?: Module[];
}

interface Module {
  id: string;
  module_order: number;
  module_name: string;
  duration_hours?: number;
  cpd_credits?: number;
}

interface Trainee {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
  professional_category: string;
  current_facility?: string;
  current_province?: string;
  total_cpd_credits: number;
}

interface Enrolment {
  first_name: string;
  last_name: string;
  professional_category: string;
  current_facility?: string;
  current_province?: string;
  status: string;
  overall_score_pct?: number;
  cpd_credits_earned?: number;
  certificate_number?: string;
  certificate_date?: string;
}

interface Props {
  token: string;
  tenantSlug: string;
}

const statusColor: Record<string, string> = {
  enrolled: '#dbeafe',
  in_progress: '#fef3c7',
  passed: '#d1fae5',
  failed: '#fee2e2',
  withdrawn: '#f3f4f6',
  completed: '#d1fae5',
};
const statusText: Record<string, string> = {
  enrolled: '#1d4ed8', in_progress: '#92400e', passed: '#065f46',
  failed: '#991b1b', withdrawn: '#6b7280', completed: '#065f46',
};

export default function TrainingDashboard({ token, tenantSlug }: Props) {
  const [tab, setTab] = useState<TabId>('courses');
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [trainees, setTrainees] = useState<Trainee[]>([]);
  const [traineeSearch, setTraineeSearch] = useState('');
  const [cohortEnrolments, setCohortEnrolments] = useState<Enrolment[]>([]);
  const [alumni, setAlumni] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [showNewTrainee, setShowNewTrainee] = useState(false);
  const [showEnrol, setShowEnrol] = useState(false);
  const [traineeForm, setTraineeForm] = useState({
    firstName: '', lastName: '', email: '', phone: '', professionalCategory: '',
    currentFacility: '', currentDistrict: '', currentProvince: '', employer: '', registrationNumber: '',
  });
  const [enrolForm, setEnrolForm] = useState({
    traineeId: '', cohortLabel: '', startDate: '', endDate: '',
  });
  const [saving, setSaving] = useState(false);
  const [cohortCourseId, setCohortCourseId] = useState('');
  const [cohortLabel, setCohortLabel] = useState('');

  useEffect(() => {
    loadCourses();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (tab === 'alumni') loadAlumni();
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadCourses() {
    setLoading(true);
    const { data } = await ehrApi.listTrainingCourses(token, tenantSlug);
    setCourses(data || []);
    setLoading(false);
  }

  async function selectCourse(c: Course) {
    const { data } = await ehrApi.getTrainingCourse(c.id, token, tenantSlug);
    setSelectedCourse(data);
  }

  async function loadTrainees(q = '') {
    setLoading(true);
    const { data } = await ehrApi.searchTrainees(q, token, tenantSlug);
    setTrainees(data || []);
    setLoading(false);
  }

  async function loadAlumni() {
    setLoading(true);
    const { data } = await ehrApi.getAlumniByFacility(token, tenantSlug);
    setAlumni(data || []);
    setLoading(false);
  }

  async function loadCohortReport() {
    if (!cohortCourseId) return;
    setLoading(true);
    const { data } = await ehrApi.getCohortReport(cohortCourseId, cohortLabel, token, tenantSlug);
    setCohortEnrolments(data || []);
    setLoading(false);
  }

  async function handleCreateTrainee(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await ehrApi.registerTrainee(traineeForm, token, tenantSlug);
    setSaving(false);
    setShowNewTrainee(false);
    setTraineeForm({ firstName: '', lastName: '', email: '', phone: '', professionalCategory: '', currentFacility: '', currentDistrict: '', currentProvince: '', employer: '', registrationNumber: '' });
    loadTrainees(traineeSearch);
  }

  async function handleEnrol(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await ehrApi.enrolTrainee({
      traineeId: enrolForm.traineeId,
      courseId: selectedCourse!.id,
      cohortLabel: enrolForm.cohortLabel || undefined,
      startDate: enrolForm.startDate,
      endDate: enrolForm.endDate || undefined,
    }, token, tenantSlug);
    setSaving(false);
    setShowEnrol(false);
    setEnrolForm({ traineeId: '', cohortLabel: '', startDate: '', endDate: '' });
  }

  const tabBtn = (id: TabId, label: string) => (
    <button
      onClick={() => { setTab(id); if (id === 'trainees' && trainees.length === 0) loadTrainees(); }}
      style={{
        padding: '8px 20px', cursor: 'pointer', background: 'none', border: 'none',
        borderBottom: tab === id ? '3px solid #6366f1' : '3px solid transparent',
        fontWeight: tab === id ? 700 : 400,
        color: tab === id ? '#6366f1' : '#374151',
        fontSize: 14,
      }}
    >
      {label}
    </button>
  );

  const statusBadge = (s: string) => (
    <span style={{ padding: '2px 10px', borderRadius: 10, fontSize: 12, fontWeight: 600,
      background: statusColor[s] || '#f3f4f6', color: statusText[s] || '#6b7280' }}>
      {s}
    </span>
  );

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ margin: '0 0 16px', fontSize: 22 }}>Healthcare Worker Training Platform</h2>

      <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', marginBottom: 20 }}>
        {tabBtn('courses', 'Courses')}
        {tabBtn('trainees', 'Trainees')}
        {tabBtn('enrolments', 'Cohort Report')}
        {tabBtn('alumni', 'Alumni Map')}
      </div>

      {/* Courses tab */}
      {tab === 'courses' && (
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 24 }}>
          <div>
            {loading ? <p style={{ color: '#6b7280' }}>Loading...</p> :
              courses.map(c => (
                <div key={c.id} onClick={() => selectCourse(c)}
                  style={{ padding: 14, borderRadius: 8, marginBottom: 10, cursor: 'pointer',
                    border: selectedCourse?.id === c.id ? '2px solid #6366f1' : '1px solid #e5e7eb',
                    background: selectedCourse?.id === c.id ? '#f5f3ff' : '#fff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{c.course_code}</span>
                    {c.cpd_credits && <span style={{ fontSize: 12, color: '#6366f1', fontWeight: 600 }}>{c.cpd_credits} CPD</span>}
                  </div>
                  <div style={{ fontSize: 13, color: '#374151', marginTop: 2 }}>{c.course_name}</div>
                  <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>
                    {c.duration_days ? `${c.duration_days} days` : ''} · Pass mark: {c.pass_mark_pct}%
                  </div>
                </div>
              ))}
          </div>
          {selectedCourse && (
            <div>
              <div style={{ background: '#f9fafb', borderRadius: 8, padding: 20, border: '1px solid #e5e7eb', marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ margin: '0 0 4px' }}>{selectedCourse.course_name}</h3>
                    <div style={{ fontSize: 13, color: '#6b7280' }}>{selectedCourse.accrediting_body}</div>
                    <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>Audience: {selectedCourse.target_audience}</div>
                  </div>
                  <button onClick={() => setShowEnrol(true)}
                    style={{ background: '#10b981', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                    Enrol Trainee
                  </button>
                </div>
              </div>
              {selectedCourse.modules && selectedCourse.modules.length > 0 && (
                <div>
                  <h4 style={{ margin: '0 0 10px' }}>Curriculum ({selectedCourse.modules.length} modules)</h4>
                  {selectedCourse.modules.map((m, i) => (
                    <div key={m.id} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid #f3f4f6', alignItems: 'flex-start' }}>
                      <span style={{ width: 24, height: 24, borderRadius: '50%', background: '#6366f1', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{m.module_name}</div>
                        <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
                          {m.duration_hours ? `${m.duration_hours}h` : ''} {m.cpd_credits ? `· ${m.cpd_credits} CPD` : ''}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Trainees tab */}
      {tab === 'trainees' && (
        <div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <input
              value={traineeSearch}
              onChange={e => setTraineeSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && loadTrainees(traineeSearch)}
              placeholder="Search by name, facility, email…"
              style={{ flex: 1, padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db' }}
            />
            <button onClick={() => loadTrainees(traineeSearch)}
              style={{ padding: '8px 16px', borderRadius: 6, background: '#6366f1', color: '#fff', border: 'none', cursor: 'pointer' }}>
              Search
            </button>
            <button onClick={() => setShowNewTrainee(true)}
              style={{ padding: '8px 16px', borderRadius: 6, background: '#10b981', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
              + Register Trainee
            </button>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {['Name', 'Category', 'Facility', 'Province', 'CPD Credits'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {trainees.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: 16, color: '#9ca3af', textAlign: 'center' }}>Search to find trainees</td></tr>
              ) : trainees.map(t => (
                <tr key={t.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '10px 12px' }}>{t.last_name}, {t.first_name}</td>
                  <td style={{ padding: '10px 12px', color: '#6b7280' }}>{t.professional_category}</td>
                  <td style={{ padding: '10px 12px', color: '#6b7280' }}>{t.current_facility || '—'}</td>
                  <td style={{ padding: '10px 12px', color: '#6b7280' }}>{t.current_province || '—'}</td>
                  <td style={{ padding: '10px 12px', fontWeight: 600, color: '#6366f1' }}>{t.total_cpd_credits}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Cohort Report tab */}
      {tab === 'enrolments' && (
        <div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'flex-end' }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, marginBottom: 4, color: '#6b7280' }}>Course</label>
              <select value={cohortCourseId} onChange={e => setCohortCourseId(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db' }}>
                <option value="">— Select Course —</option>
                {courses.map(c => <option key={c.id} value={c.id}>{c.course_code} — {c.course_name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, marginBottom: 4, color: '#6b7280' }}>Cohort Label (optional)</label>
              <input value={cohortLabel} onChange={e => setCohortLabel(e.target.value)}
                placeholder="e.g. May 2026" style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db' }} />
            </div>
            <button onClick={loadCohortReport}
              style={{ padding: '8px 16px', borderRadius: 6, background: '#6366f1', color: '#fff', border: 'none', cursor: 'pointer' }}>
              Load Report
            </button>
          </div>
          {cohortEnrolments.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  {['Name', 'Category', 'Facility', 'Province', 'Status', 'Score', 'CPD', 'Certificate'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cohortEnrolments.map((e, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '10px 12px' }}>{e.last_name}, {e.first_name}</td>
                    <td style={{ padding: '10px 12px', color: '#6b7280' }}>{e.professional_category}</td>
                    <td style={{ padding: '10px 12px', color: '#6b7280' }}>{e.current_facility || '—'}</td>
                    <td style={{ padding: '10px 12px', color: '#6b7280' }}>{e.current_province || '—'}</td>
                    <td style={{ padding: '10px 12px' }}>{statusBadge(e.status)}</td>
                    <td style={{ padding: '10px 12px' }}>{e.overall_score_pct != null ? `${Number(e.overall_score_pct).toFixed(1)}%` : '—'}</td>
                    <td style={{ padding: '10px 12px' }}>{e.cpd_credits_earned ?? '—'}</td>
                    <td style={{ padding: '10px 12px', fontSize: 11, color: '#6366f1' }}>{e.certificate_number || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Alumni Map tab */}
      {tab === 'alumni' && (
        <div>
          <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>Trained Staff by Facility</h3>
          {loading ? <p style={{ color: '#6b7280' }}>Loading...</p> : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  {['Facility', 'District', 'Province', 'Trained Staff', 'Total CPD Earned', 'Courses'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {alumni.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: 16, color: '#9ca3af', textAlign: 'center' }}>No alumni data yet</td></tr>
                ) : alumni.map((a, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 600 }}>{a.current_facility || '—'}</td>
                    <td style={{ padding: '10px 12px', color: '#6b7280' }}>{a.current_district || '—'}</td>
                    <td style={{ padding: '10px 12px', color: '#6b7280' }}>{a.current_province || '—'}</td>
                    <td style={{ padding: '10px 12px', color: '#6366f1', fontWeight: 700 }}>{a.trained_staff}</td>
                    <td style={{ padding: '10px 12px' }}>{a.total_cpd_earned}</td>
                    <td style={{ padding: '10px 12px', fontSize: 11, color: '#6b7280' }}>
                      {Array.isArray(a.courses_completed) ? a.courses_completed.join(', ') : a.courses_completed}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Register Trainee Modal */}
      {showNewTrainee && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <form onSubmit={handleCreateTrainee} style={{ background: '#fff', borderRadius: 10, padding: 28, width: 480, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}>
            <h3 style={{ margin: '0 0 16px' }}>Register Trainee</h3>
            {([
              { label: 'First Name *', key: 'firstName', required: true },
              { label: 'Last Name *', key: 'lastName', required: true },
              { label: 'Email', key: 'email', required: false },
              { label: 'Phone', key: 'phone', required: false },
              { label: 'Professional Category *', key: 'professionalCategory', required: true },
              { label: 'Current Facility', key: 'currentFacility', required: false },
              { label: 'District', key: 'currentDistrict', required: false },
              { label: 'Province', key: 'currentProvince', required: false },
              { label: 'Employer', key: 'employer', required: false },
              { label: 'Council Registration No.', key: 'registrationNumber', required: false },
            ] as Array<{ label: string; key: keyof typeof traineeForm; required: boolean }>).map(f => (
              <div key={f.key} style={{ marginBottom: 10 }}>
                <label style={{ display: 'block', fontSize: 13, marginBottom: 4, color: '#374151' }}>{f.label}</label>
                <input
                  type="text"
                  required={f.required}
                  value={traineeForm[f.key]}
                  onChange={e => setTraineeForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #d1d5db', boxSizing: 'border-box' }}
                />
              </div>
            ))}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
              <button type="button" onClick={() => setShowNewTrainee(false)} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer' }}>Cancel</button>
              <button type="submit" disabled={saving} style={{ padding: '8px 16px', borderRadius: 6, background: '#6366f1', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                {saving ? 'Saving...' : 'Register'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Enrol Trainee Modal */}
      {showEnrol && selectedCourse && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <form onSubmit={handleEnrol} style={{ background: '#fff', borderRadius: 10, padding: 28, width: 420, boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}>
            <h3 style={{ margin: '0 0 16px' }}>Enrol in {selectedCourse.course_name}</h3>
            {([
              { label: 'Trainee ID *', key: 'traineeId', required: true },
              { label: 'Cohort Label', key: 'cohortLabel', required: false },
              { label: 'Start Date *', key: 'startDate', required: true, type: 'date' },
              { label: 'End Date', key: 'endDate', required: false, type: 'date' },
            ] as Array<{ label: string; key: keyof typeof enrolForm; required: boolean; type?: string }>).map(f => (
              <div key={f.key} style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 13, marginBottom: 4, color: '#374151' }}>{f.label}</label>
                <input
                  type={f.type || 'text'}
                  required={f.required}
                  value={enrolForm[f.key]}
                  onChange={e => setEnrolForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #d1d5db', boxSizing: 'border-box' }}
                />
              </div>
            ))}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
              <button type="button" onClick={() => setShowEnrol(false)} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer' }}>Cancel</button>
              <button type="submit" disabled={saving} style={{ padding: '8px 16px', borderRadius: 6, background: '#10b981', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                {saving ? 'Enrolling...' : 'Enrol'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
