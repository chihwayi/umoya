import React, { useState, useEffect } from 'react';

interface AlumniRecord {
  id: string;
  first_name: string;
  last_name: string;
  facility_name: string;
  course_name: string;
  alumni_since: string;
  cpd_total_credits: number;
}

interface AlumniNetworkPageProps {
  token: string;
  tenantSlug: string;
}

const API_BASE = process.env.REACT_APP_EHR_API_URL ?? 'http://localhost:3001';

export const AlumniNetworkPage: React.FC<AlumniNetworkPageProps> = ({ token, tenantSlug }) => {
  const [alumni, setAlumni] = useState<AlumniRecord[]>([]);
  const [search, setSearch] = useState('');
  const [facilityFilter, setFacilityFilter] = useState('');
  const [loading, setLoading] = useState(false);

  const headers = { Authorization: `Bearer ${token}`, 'x-tenant-slug': tenantSlug };

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (facilityFilter) params.set('facility', facilityFilter);
    fetch(`${API_BASE}/training/alumni?${params}`, { headers })
      .then((r) => r.ok ? r.json() : [])
      .then(setAlumni)
      .catch(() => setAlumni([]))
      .finally(() => setLoading(false));
  }, [search, facilityFilter]);

  const exportCsv = () => {
    const header = 'Name,Facility,Course,CPD Credits,Alumni Since';
    const rows = alumni.map(
      (a) => `${a.first_name} ${a.last_name},${a.facility_name},${a.course_name},${a.cpd_total_credits},${a.alumni_since}`,
    );
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'newlands_alumni.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const facilities = [...new Set(alumni.map((a) => a.facility_name))].sort();

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ margin: '0 0 16px', fontSize: 20, fontWeight: 700 }}>Alumni Network</h2>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          placeholder="Search by name or facility..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ padding: '8px 12px', flex: 1, minWidth: 200, border: '1px solid #d1d5db', borderRadius: 4, fontSize: 13 }}
        />
        <select
          value={facilityFilter}
          onChange={(e) => setFacilityFilter(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 13 }}
        >
          <option value="">All Facilities</option>
          {facilities.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
        <button
          onClick={exportCsv}
          style={{ padding: '8px 16px', background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13 }}
        >
          Export CSV
        </button>
      </div>

      {loading ? (
        <p style={{ color: '#6b7280', fontSize: 13 }}>Loading alumni...</p>
      ) : alumni.length === 0 ? (
        <p style={{ color: '#9ca3af', fontSize: 13 }}>No alumni records found.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f3f4f6' }}>
              {['Name', 'Facility', 'Course', 'CPD Credits', 'Alumni Since'].map((h) => (
                <th key={h} style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {alumni.map((a) => (
              <tr key={a.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '8px 12px' }}>{a.first_name} {a.last_name}</td>
                <td style={{ padding: '8px 12px' }}>{a.facility_name}</td>
                <td style={{ padding: '8px 12px' }}>{a.course_name}</td>
                <td style={{ padding: '8px 12px', textAlign: 'center' }}>{a.cpd_total_credits}</td>
                <td style={{ padding: '8px 12px' }}>{a.alumni_since}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p style={{ marginTop: 12, fontSize: 12, color: '#9ca3af' }}>
        {alumni.length} record{alumni.length !== 1 ? 's' : ''}
      </p>
    </div>
  );
};
