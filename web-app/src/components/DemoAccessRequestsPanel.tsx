import React, { useEffect, useMemo, useState } from 'react';
import { DemoAccessRequest, DemoAccessRequestStatus } from '../types';
import { demoAccessRequestAPI } from '../services/api';
import { useNotification } from '../contexts/NotificationContext';

const statusOrder: DemoAccessRequestStatus[] = ['new', 'reviewing', 'approved', 'provisioned', 'rejected'];

const statusStyles: Record<DemoAccessRequestStatus, string> = {
  new: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  reviewing: 'bg-[#FF7A40]/10 text-[#FFBD9A] border-amber-200',
  approved: 'bg-[#00C896]/10 text-[#6EE7C2] border-emerald-200',
  provisioned: 'bg-[#2B7FFF]/10 text-[#93C5FD] border-blue-200',
  rejected: 'bg-rose-50 text-rose-700 border-rose-200',
};

export const DemoAccessRequestsPanel: React.FC = () => {
  const { success, error: notifyError } = useNotification();
  const [requests, setRequests] = useState<DemoAccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | DemoAccessRequestStatus>('all');
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [draftStatus, setDraftStatus] = useState<DemoAccessRequestStatus>('new');
  const [draftNotes, setDraftNotes] = useState('');
  const [draftSubdomain, setDraftSubdomain] = useState('');
  const [saving, setSaving] = useState(false);
  const [provisioning, setProvisioning] = useState(false);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const data = await demoAccessRequestAPI.list(statusFilter === 'all' ? undefined : statusFilter);
      setRequests(data);
    } catch (err) {
      notifyError('Requests', 'Failed to load demo access requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, [statusFilter]);

  useEffect(() => {
    const selected = requests.find((item) => item.id === selectedRequestId) || null;
    if (!selected) {
      setDraftStatus('new');
      setDraftNotes('');
      setDraftSubdomain('');
      return;
    }
    setDraftStatus(selected.status);
    setDraftNotes(selected.adminNotes || '');
    setDraftSubdomain(selected.assignedSubdomain || '');
  }, [selectedRequestId, requests]);

  const stats = useMemo(() => {
    return statusOrder.reduce<Record<DemoAccessRequestStatus, number>>((acc, key) => {
      acc[key] = requests.filter((request) => request.status === key).length;
      return acc;
    }, {
      new: 0,
      reviewing: 0,
      approved: 0,
      provisioned: 0,
      rejected: 0,
    });
  }, [requests]);

  const selectedRequest = requests.find((item) => item.id === selectedRequestId) || null;

  const saveReview = async () => {
    if (!selectedRequest) return;
    try {
      setSaving(true);
      const updated = await demoAccessRequestAPI.updateStatus(selectedRequest.id, {
        status: draftStatus,
        adminNotes: draftNotes,
        assignedSubdomain: draftSubdomain,
      });
      setRequests((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      success('Requests', 'Demo request updated');
    } catch (err) {
      notifyError('Requests', 'Failed to update demo access request');
    } finally {
      setSaving(false);
    }
  };

  const provisionTenant = async () => {
    if (!selectedRequest) return;
    try {
      setProvisioning(true);
      const result = await demoAccessRequestAPI.provisionTenant(selectedRequest.id);
      setRequests((current) => current.map((item) => (item.id === result.request.id ? result.request : item)));
      setSelectedRequestId(result.request.id);
      success('Requests', `Testing tenant provisioned: ${result.tenant.subdomain}`);
    } catch (err: any) {
      notifyError('Requests', err?.response?.data?.message || 'Failed to provision testing tenant');
    } finally {
      setProvisioning(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-white">Demo Access Requests</h2>
          <p className="mt-1 text-sm text-[#7A9AB8]">
            Review doctors and clinics requesting guided MediCore test access before creating testing tenants.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setStatusFilter('all')}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              statusFilter === 'all'
                ? 'bg-[#060C16] text-white'
                : 'border border-white/[0.07] bg-white text-[#8FA8CC] hover:bg-[#080E1A]'
            }`}
          >
            All
          </button>
          {statusOrder.map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`rounded-full px-4 py-2 text-sm font-medium capitalize transition ${
                statusFilter === status
                  ? 'bg-[#060C16] text-white'
                  : 'border border-white/[0.07] bg-white text-[#8FA8CC] hover:bg-[#080E1A]'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
        {statusOrder.map((status) => (
          <div key={status} className="rounded-lg border border-white/[0.07] bg-white p-5 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wider text-[#7A9AB8]">{status}</div>
            <div className="mt-2 text-3xl font-semibold text-white">{stats[status]}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="overflow-hidden rounded-xl border border-white/[0.07] bg-white shadow-sm">
          <div className="border-b border-white/[0.07] px-6 py-4">
            <h3 className="text-lg font-semibold text-white">Incoming queue</h3>
          </div>
          {loading ? (
            <div className="flex min-h-[18rem] items-center justify-center text-sm text-[#7A9AB8]">
              Loading requests...
            </div>
          ) : requests.length === 0 ? (
            <div className="flex min-h-[18rem] items-center justify-center text-sm text-[#7A9AB8]">
              No requests found for this filter.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {requests.map((request) => (
                <button
                  key={request.id}
                  onClick={() => setSelectedRequestId(request.id)}
                  className={`w-full px-6 py-5 text-left transition hover:bg-[#080E1A] ${
                    selectedRequestId === request.id ? 'bg-[#080E1A]' : 'bg-white'
                  }`}
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="text-base font-semibold text-white">{request.fullName}</div>
                      <div className="mt-1 text-sm text-[#7A9AB8]">
                        {request.roleTitle || 'Doctor'}{request.specialization ? ` • ${request.specialization}` : ''} • {request.clinicName}
                      </div>
                      <div className="mt-2 text-sm text-[#8FA8CC]">{request.workEmail} • {request.phone}</div>
                      <div className="mt-3 line-clamp-2 text-sm text-[#7A9AB8]">{request.interestSummary}</div>
                    </div>
                    <div className="flex flex-col items-start gap-2 md:items-end">
                      <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${statusStyles[request.status]}`}>
                        {request.status}
                      </span>
                      <span className="text-xs text-[#5A78A0]">
                        {new Date(request.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-white/[0.07] bg-white shadow-sm">
          <div className="border-b border-white/[0.07] px-6 py-4">
            <h3 className="text-lg font-semibold text-white">Review panel</h3>
          </div>

          {!selectedRequest ? (
            <div className="flex min-h-[18rem] items-center justify-center px-6 text-center text-sm text-[#7A9AB8]">
              Select a request to review notes, update status, and capture the tenant subdomain you provision.
            </div>
          ) : (
            <div className="space-y-5 px-6 py-5">
              <div>
                <div className="text-xl font-semibold text-white">{selectedRequest.fullName}</div>
                <div className="mt-1 text-sm text-[#7A9AB8]">
                  {selectedRequest.roleTitle || 'Doctor'}{selectedRequest.specialization ? ` • ${selectedRequest.specialization}` : ''}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-[#7A9AB8]">Clinic</div>
                  <div className="mt-1 text-sm text-white">{selectedRequest.clinicName}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-[#7A9AB8]">Current system</div>
                  <div className="mt-1 text-sm text-white">{selectedRequest.currentSystem || 'Not provided'}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-[#7A9AB8]">Provisioned tenant</div>
                  <div className="mt-1 text-sm text-white">{selectedRequest.assignedSubdomain || 'Not yet provisioned'}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-[#7A9AB8]">Work email</div>
                  <div className="mt-1 text-sm text-white">{selectedRequest.workEmail}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-[#7A9AB8]">Phone</div>
                  <div className="mt-1 text-sm text-white">{selectedRequest.phone}</div>
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-[#7A9AB8]">Interest areas</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedRequest.interestAreas.map((interest) => (
                    <span key={interest} className="rounded-full border border-white/[0.07] bg-[#080E1A] px-3 py-1 text-xs font-medium text-[#C5D5EE]">
                      {interest}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-[#7A9AB8]">Why they want access</div>
                <p className="mt-2 rounded-2xl bg-[#080E1A] p-4 text-sm leading-6 text-[#C5D5EE]">
                  {selectedRequest.interestSummary}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[#7A9AB8]">Status</span>
                  <select
                    value={draftStatus}
                    onChange={(event) => setDraftStatus(event.target.value as DemoAccessRequestStatus)}
                    className="w-full rounded-2xl border border-white/[0.10] bg-white px-3 py-2 text-sm text-white focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
                  >
                    {statusOrder.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[#7A9AB8]">Provisioned subdomain</span>
                  <input
                    value={draftSubdomain}
                    onChange={(event) => setDraftSubdomain(event.target.value)}
                    className="w-full rounded-2xl border border-white/[0.10] bg-white px-3 py-2 text-sm text-white focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
                    placeholder="testing-tenant-subdomain"
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[#7A9AB8]">Admin notes</span>
                <textarea
                  rows={6}
                  value={draftNotes}
                  onChange={(event) => setDraftNotes(event.target.value)}
                  className="w-full rounded-2xl border border-white/[0.10] bg-white px-3 py-2 text-sm text-white focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
                  placeholder="Capture decision notes, next follow-up, and what testing tenant you plan to provision."
                />
              </label>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={saveReview}
                  disabled={saving}
                  className="inline-flex items-center rounded-2xl bg-[#060C16] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#0D1829] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? 'Saving...' : 'Save review'}
                </button>
                <button
                  onClick={provisionTenant}
                  disabled={provisioning}
                  className="inline-flex items-center rounded-2xl border border-emerald-300 bg-[#00C896]/10 px-4 py-2.5 text-sm font-medium text-[#6EE7C2] transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {provisioning ? 'Provisioning...' : 'Provision testing tenant'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
