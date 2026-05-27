import React, { useEffect, useState } from 'react';
import { ehrApi as api } from '../services/api';

interface Group {
  id: string;
  name: string;
  group_type: string;
  facilitator_name?: string;
  meeting_day?: string;
  meeting_time?: string;
  location?: string;
  status: string;
  member_count?: number;
}

interface AttendanceStat {
  session_date: string;
  expected_count: number;
  actual_count: number;
  attendance_pct: number;
}

interface Props {
  token: string;
  tenantSlug: string;
}

export default function SupportGroupsPage({ token, tenantSlug }: Props) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [selected, setSelected] = useState<Group | null>(null);
  const [attendanceStats, setAttendanceStats] = useState<AttendanceStat[]>([]);
  const [loading, setLoading] = useState(false);

  const [showNewGroup, setShowNewGroup] = useState(false);
  const [showSession, setShowSession] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);

  const [groupForm, setGroupForm] = useState({
    name: '', groupType: '', facilitatorName: '', meetingDay: '', meetingTime: '', location: '',
  });
  const [sessionForm, setSessionForm] = useState({
    sessionDate: '', topic: '', expectedCount: '', notes: '',
  });
  const [memberPatientId, setMemberPatientId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadGroups();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadGroups() {
    setLoading(true);
    const { data } = await api.listSupportGroups(token, tenantSlug);
    setGroups(data || []);
    setLoading(false);
  }

  async function selectGroup(g: Group) {
    setSelected(g);
    const { data } = await api.getGroupAttendanceStats(g.id, token, tenantSlug);
    setAttendanceStats(data || []);
  }

  async function handleCreateGroup(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await api.createSupportGroup({
      name: groupForm.name,
      groupType: groupForm.groupType,
      facilitatorName: groupForm.facilitatorName || undefined,
      meetingDay: groupForm.meetingDay || undefined,
      meetingTime: groupForm.meetingTime || undefined,
      location: groupForm.location || undefined,
    }, token, tenantSlug);
    setSaving(false);
    setShowNewGroup(false);
    setGroupForm({ name: '', groupType: '', facilitatorName: '', meetingDay: '', meetingTime: '', location: '' });
    loadGroups();
  }

  async function handleCreateSession(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setSaving(true);
    await api.createGroupSession(selected.id, {
      sessionDate: sessionForm.sessionDate,
      topic: sessionForm.topic || undefined,
      expectedCount: sessionForm.expectedCount ? Number(sessionForm.expectedCount) : undefined,
      notes: sessionForm.notes || undefined,
    }, token, tenantSlug);
    setSaving(false);
    setShowSession(false);
    setSessionForm({ sessionDate: '', topic: '', expectedCount: '', notes: '' });
    selectGroup(selected);
  }

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !memberPatientId) return;
    setSaving(true);
    await api.addGroupMember(selected.id, memberPatientId, token, tenantSlug);
    setSaving(false);
    setShowAddMember(false);
    setMemberPatientId('');
    loadGroups();
  }

  const pctColor = (pct: number) => pct >= 80 ? '#10b981' : pct >= 60 ? '#f59e0b' : '#ef4444';

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 22 }}>Support Groups</h2>
        <button
          onClick={() => setShowNewGroup(true)}
          style={{ background: '#6366f1', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 18px', cursor: 'pointer', fontWeight: 600 }}
        >
          + New Group
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 24 }}>
        {/* Group list */}
        <div>
          {loading ? (
            <p style={{ color: '#6b7280' }}>Loading...</p>
          ) : groups.length === 0 ? (
            <p style={{ color: '#6b7280' }}>No support groups yet.</p>
          ) : (
            groups.map(g => (
              <div
                key={g.id}
                onClick={() => selectGroup(g)}
                style={{
                  padding: 14, borderRadius: 8, marginBottom: 10, cursor: 'pointer',
                  border: selected?.id === g.id ? '2px solid #6366f1' : '1px solid #e5e7eb',
                  background: selected?.id === g.id ? '#f5f3ff' : '#fff',
                }}
              >
                <div style={{ fontWeight: 600 }}>{g.name}</div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 3 }}>
                  {g.group_type} · {g.member_count ?? 0} members
                </div>
                {g.meeting_day && (
                  <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
                    {g.meeting_day} {g.meeting_time ? `@ ${g.meeting_time}` : ''}
                    {g.location ? ` · ${g.location}` : ''}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Detail panel */}
        {selected ? (
          <div>
            <div style={{ background: '#f9fafb', borderRadius: 8, padding: 20, border: '1px solid #e5e7eb', marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ margin: '0 0 4px' }}>{selected.name}</h3>
                  <span style={{ fontSize: 13, color: '#6b7280' }}>{selected.group_type}</span>
                  {selected.facilitator_name && (
                    <span style={{ fontSize: 13, color: '#6b7280' }}> · Facilitated by {selected.facilitator_name}</span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => setShowAddMember(true)}
                    style={{ background: '#10b981', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
                  >
                    Add Member
                  </button>
                  <button
                    onClick={() => setShowSession(true)}
                    style={{ background: '#6366f1', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
                  >
                    Record Session
                  </button>
                </div>
              </div>
            </div>

            <h4 style={{ margin: '0 0 12px', fontSize: 15 }}>Attendance — Last 12 Sessions</h4>
            {attendanceStats.length === 0 ? (
              <p style={{ color: '#6b7280', fontSize: 13 }}>No sessions recorded yet.</p>
            ) : (
              <div>
                {attendanceStats.map((s, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', marginBottom: 8, gap: 12 }}>
                    <span style={{ width: 90, fontSize: 12, color: '#6b7280' }}>{s.session_date?.slice(0, 10)}</span>
                    <div style={{ flex: 1, background: '#e5e7eb', borderRadius: 4, height: 10 }}>
                      <div
                        style={{ width: `${Math.min(s.attendance_pct, 100)}%`, background: pctColor(s.attendance_pct), height: '100%', borderRadius: 4, transition: 'width 0.3s' }}
                      />
                    </div>
                    <span style={{ width: 50, fontSize: 12, fontWeight: 600, color: pctColor(s.attendance_pct) }}>
                      {Number(s.attendance_pct).toFixed(0)}%
                    </span>
                    <span style={{ fontSize: 12, color: '#9ca3af' }}>
                      {s.actual_count}/{s.expected_count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 14 }}>
            Select a group to view details
          </div>
        )}
      </div>

      {/* New Group Modal */}
      {showNewGroup && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <form onSubmit={handleCreateGroup} style={{ background: '#fff', borderRadius: 10, padding: 28, width: 440, boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}>
            <h3 style={{ margin: '0 0 16px' }}>New Support Group</h3>
            {[
              { label: 'Group Name *', key: 'name', required: true },
              { label: 'Group Type *', key: 'groupType', required: true },
              { label: 'Facilitator Name', key: 'facilitatorName', required: false },
              { label: 'Meeting Day', key: 'meetingDay', required: false },
              { label: 'Meeting Time', key: 'meetingTime', required: false },
              { label: 'Location', key: 'location', required: false },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 10 }}>
                <label style={{ display: 'block', fontSize: 13, marginBottom: 4, color: '#374151' }}>{f.label}</label>
                <input
                  type="text"
                  required={f.required}
                  value={(groupForm as any)[f.key]}
                  onChange={e => setGroupForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #d1d5db', boxSizing: 'border-box' }}
                />
              </div>
            ))}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
              <button type="button" onClick={() => setShowNewGroup(false)} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer' }}>Cancel</button>
              <button type="submit" disabled={saving} style={{ padding: '8px 16px', borderRadius: 6, background: '#6366f1', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                {saving ? 'Saving...' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Record Session Modal */}
      {showSession && selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <form onSubmit={handleCreateSession} style={{ background: '#fff', borderRadius: 10, padding: 28, width: 420, boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}>
            <h3 style={{ margin: '0 0 16px' }}>Record Session — {selected.name}</h3>
            {[
              { label: 'Session Date *', key: 'sessionDate', required: true, type: 'date' },
              { label: 'Topic', key: 'topic', required: false },
              { label: 'Expected Attendees', key: 'expectedCount', required: false, type: 'number' },
              { label: 'Notes', key: 'notes', required: false },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 10 }}>
                <label style={{ display: 'block', fontSize: 13, marginBottom: 4, color: '#374151' }}>{f.label}</label>
                <input
                  type={f.type || 'text'}
                  required={f.required}
                  value={(sessionForm as any)[f.key]}
                  onChange={e => setSessionForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #d1d5db', boxSizing: 'border-box' }}
                />
              </div>
            ))}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
              <button type="button" onClick={() => setShowSession(false)} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer' }}>Cancel</button>
              <button type="submit" disabled={saving} style={{ padding: '8px 16px', borderRadius: 6, background: '#6366f1', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add Member Modal */}
      {showAddMember && selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <form onSubmit={handleAddMember} style={{ background: '#fff', borderRadius: 10, padding: 28, width: 360, boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}>
            <h3 style={{ margin: '0 0 16px' }}>Add Member — {selected.name}</h3>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, marginBottom: 4, color: '#374151' }}>Patient ID *</label>
              <input
                type="text"
                required
                value={memberPatientId}
                onChange={e => setMemberPatientId(e.target.value)}
                style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #d1d5db', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setShowAddMember(false)} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer' }}>Cancel</button>
              <button type="submit" disabled={saving} style={{ padding: '8px 16px', borderRadius: 6, background: '#10b981', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                {saving ? 'Adding...' : 'Add'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
