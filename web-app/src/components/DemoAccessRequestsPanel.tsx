import React, { useEffect, useMemo, useState } from 'react';
import { DemoAccessRequest, DemoAccessRequestStatus } from '../types';
import { demoAccessRequestAPI } from '../services/api';
import { useNotification } from '../contexts/NotificationContext';

const statusOrder: DemoAccessRequestStatus[] = ['new', 'reviewing', 'approved', 'provisioned', 'rejected'];

const statusStyles: Record<DemoAccessRequestStatus, string> = {
  new: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  reviewing: 'bg-amber-50 text-amber-700 border-amber-200',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  provisioned: 'bg-blue-50 text-blue-700 border-blue-200',
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
          <h2 className="text-2xl font-semibold text-slate-900">Demo Access Requests</h2>
          <p className="mt-1 text-sm text-slate-500">
            Review doctors and clinics requesting guided MediCore test access before creating testing tenants.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setStatusFilter('all')}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              statusFilter === 'all'
                ? 'bg-slate-900 text-white'
                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
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
                  ? 'bg-slate-900 text-white'
                  : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
        {statusOrder.map((status) => (
          <div key={status} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{status}</div>
            <div className="mt-2 text-3xl font-semibold text-slate-900">{stats[status]}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-4">
            <h3 className="text-lg font-semibold text-slate-900">Incoming queue</h3>
          </div>
          {loading ? (
            <div className="flex min-h-[18rem] items-center justify-center text-sm text-slate-500">
              Loading requests...
            </div>
          ) : requests.length === 0 ? (
            <div className="flex min-h-[18rem] items-center justify-center text-sm text-slate-500">
              No requests found for this filter.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {requests.map((request) => (
                <button
                  key={request.id}
                  onClick={() => setSelectedRequestId(request.id)}
                  className={`w-full px-6 py-5 text-left transition hover:bg-slate-50 ${
                    selectedRequestId === request.id ? 'bg-slate-50' : 'bg-white'
                  }`}
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="text-base font-semibold text-slate-900">{request.fullName}</div>
                      <div className="mt-1 text-sm text-slate-500">
                        {request.roleTitle || 'Doctor'}{request.specialization ? ` • ${request.specialization}` : ''} • {request.clinicName}
                      </div>
                      <div className="mt-2 text-sm text-slate-600">{request.workEmail} • {request.phone}</div>
                      <div className="mt-3 line-clamp-2 text-sm text-slate-500">{request.interestSummary}</div>
                    </div>
                    <div className="flex flex-col items-start gap-2 md:items-end">
                      <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${statusStyles[request.status]}`}>
                        {request.status}
                      </span>
                      <span className="text-xs text-slate-400">
                        {new Date(request.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-4">
            <h3 className="text-lg font-semibold text-slate-900">Review panel</h3>
          </div>

          {!selectedRequest ? (
            <div className="flex min-h-[18rem] items-center justify-center px-6 text-center text-sm text-slate-500">
              Select a request to review notes, update status, and capture the tenant subdomain you provision.
            </div>
          ) : (
            <div className="space-y-5 px-6 py-5">
              <div>
                <div className="text-xl font-semibold text-slate-900">{selectedRequest.fullName}</div>
                <div className="mt-1 text-sm text-slate-500">
                  {selectedRequest.roleTitle || 'Doctor'}{selectedRequest.specialization ? ` • ${selectedRequest.specialization}` : ''}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Clinic</div>
                  <div className="mt-1 text-sm text-slate-900">{selectedRequest.clinicName}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Current system</div>
                  <div className="mt-1 text-sm text-slate-900">{selectedRequest.currentSystem || 'Not provided'}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Provisioned tenant</div>
                  <div className="mt-1 text-sm text-slate-900">{selectedRequest.assignedSubdomain || 'Not yet provisioned'}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Work email</div>
                  <div className="mt-1 text-sm text-slate-900">{selectedRequest.workEmail}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Phone</div>
                  <div className="mt-1 text-sm text-slate-900">{selectedRequest.phone}</div>
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Interest areas</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedRequest.interestAreas.map((interest) => (
                    <span key={interest} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
                      {interest}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Why they want access</div>
                <p className="mt-2 rounded-lg bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                  {selectedRequest.interestSummary}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Status</span>
                  <select
                    value={draftStatus}
                    onChange={(event) => setDraftStatus(event.target.value as DemoAccessRequestStatus)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
                  >
                    {statusOrder.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Provisioned subdomain</span>
                  <input
                    value={draftSubdomain}
                    onChange={(event) => setDraftSubdomain(event.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
                    placeholder="testing-tenant-subdomain"
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Admin notes</span>
                <textarea
                  rows={6}
                  value={draftNotes}
                  onChange={(event) => setDraftNotes(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
                  placeholder="Capture decision notes, next follow-up, and what testing tenant you plan to provision."
                />
              </label>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={saveReview}
                  disabled={saving}
                  className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? 'Saving...' : 'Save review'}
                </button>
                <button
                  onClick={provisionTenant}
                  disabled={provisioning}
                  className="inline-flex items-center rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
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
