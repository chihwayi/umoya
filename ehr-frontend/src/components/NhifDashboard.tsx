import React, { useState, useEffect } from 'react';
import { nhifApi } from '../services/api';

interface NhifDashboardProps {
  patientId?: string;
  token?: string;
  tenantSlug: string;
}

const NhifDashboard: React.FC<NhifDashboardProps> = ({ patientId, token, tenantSlug }) => {
  const [membership, setMembership] = useState<any>(null);
  const [claims, setClaims] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [enrollForm, setEnrollForm] = useState({
    schemeCode: 'NHIF_G1',
    membershipNumber: '',
    nationalId: '',
    enrollmentDate: new Date().toISOString().split('T')[0],
  });

  const authToken = token || localStorage.getItem('ehr_token') || '';

  useEffect(() => {
    if (patientId && authToken) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [patientId, authToken]);

  const fetchData = async () => {
    if (!patientId || !authToken) return;
    setLoading(true);
    try {
      const [mRes, cRes] = await Promise.all([
        nhifApi.getMembership(patientId, authToken, tenantSlug),
        nhifApi.getClaims(patientId, authToken, tenantSlug),
      ]);
      setMembership(mRes);
      setClaims(cRes);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId || !authToken) return;
    try {
      await nhifApi.enrollMember(patientId, enrollForm, authToken, tenantSlug);
      setIsEnrolling(false);
      fetchData();
    } catch (err: any) {
      alert('Enrollment failed: ' + err.message);
    }
  };

  if (!patientId) return <div className="p-8 text-center text-gray-500 italic bg-white shadow rounded-lg">Please select a patient to view NHIF/CBHI capitation details.</div>;
  if (loading) return <div className="p-4">Loading NHIF/CBHI data...</div>;

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">NHIF / CBHI Capitation</h2>
        {!membership && !isEnrolling && (
          <button
            onClick={() => setIsEnrolling(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Enroll Member
          </button>
        )}
      </div>

      {isEnrolling && (
        <form onSubmit={handleEnroll} className="mb-8 p-4 border rounded bg-gray-50">
          <h3 className="text-lg font-semibold mb-4">New Enrollment</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Scheme</label>
              <select
                value={enrollForm.schemeCode}
                onChange={(e) => setEnrollForm({ ...enrollForm, schemeCode: e.target.value })}
                className="mt-1 block w-full border rounded-md p-2"
              >
                <option value="NHIF_G1">NHIF Government (G1)</option>
                <option value="NHIF_P1">NHIF Private (P1)</option>
                <option value="CBHI_C1">CBHI Community (C1)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Membership #</label>
              <input
                type="text"
                value={enrollForm.membershipNumber}
                onChange={(e) => setEnrollForm({ ...enrollForm, membershipNumber: e.target.value })}
                className="mt-1 block w-full border rounded-md p-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">National ID</label>
              <input
                type="text"
                value={enrollForm.nationalId}
                onChange={(e) => setEnrollForm({ ...enrollForm, nationalId: e.target.value })}
                className="mt-1 block w-full border rounded-md p-2"
              />
            </div>
            <div className="flex items-end gap-2">
              <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">Save</button>
              <button type="button" onClick={() => setIsEnrolling(false)} className="bg-gray-400 text-white px-4 py-2 rounded">Cancel</button>
            </div>
          </div>
        </form>
      )}

      {membership ? (
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="p-4 border rounded bg-blue-50">
            <span className="block text-xs uppercase font-bold text-blue-600">Active Scheme</span>
            <span className="text-lg font-semibold">{membership.schemeCode}</span>
          </div>
          <div className="p-4 border rounded bg-blue-50">
            <span className="block text-xs uppercase font-bold text-blue-600">Membership Number</span>
            <span className="text-lg font-semibold">{membership.membershipNumber}</span>
          </div>
          <div className="p-4 border rounded bg-blue-50">
            <span className="block text-xs uppercase font-bold text-blue-600">Status</span>
            <span className={`text-lg font-semibold ${membership.status === 'active' ? 'text-green-600' : 'text-red-600'}`}>
              {membership.status.toUpperCase()}
            </span>
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500 italic">No NHIF/CBHI membership found for this patient.</div>
      )}

      <h3 className="text-xl font-bold mb-4">Capitation Claims History</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Period</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Co-Pay</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {claims.map((claim) => (
              <tr key={claim.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{claim.visitDate || '-'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{claim.claimPeriodMonth}/{claim.claimPeriodYear}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${claim.capitationAmount}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${claim.coPayAmount}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                    ${claim.claimStatus === 'submitted' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                    {claim.claimStatus.toUpperCase()}
                  </span>
                </td>
              </tr>
            ))}
            {claims.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-gray-500">No claims found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default NhifDashboard;
