import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BadgeDollarSign, CreditCard, ShieldCheck, Users } from 'lucide-react';
import { cbhiApi } from '../services/api';
import { useNotification } from './GlobalNotification';

type TabKey = 'households' | 'contributions' | 'claims' | 'summary';

export default function CbhiDashboard({ tenantSlug, token }: { tenantSlug: string; token: string }) {
  const { showError, showSuccess } = useNotification();
  const [tab, setTab] = useState<TabKey>('households');
  const [households, setHouseholds] = useState<any[]>([]);
  const [claims, setClaims] = useState<any[]>([]);
  const [selectedHouseholdId, setSelectedHouseholdId] = useState('');
  const [selectedHousehold, setSelectedHousehold] = useState<any | null>(null);
  const [summary, setSummary] = useState<any | null>(null);
  const [verification, setVerification] = useState<any | null>(null);
  const [verifyPatientId, setVerifyPatientId] = useState('');
  const [schemeIdFilter, setSchemeIdFilter] = useState('');
  const [claimStatusFilter, setClaimStatusFilter] = useState('');

  const [householdForm, setHouseholdForm] = useState({
    householdId: '',
    schemeId: '',
    schemeName: '',
    headOfHouseholdPatientId: '',
    householdName: '',
    village: '',
    ward: '',
    district: '',
    membershipStartDate: new Date().toISOString().slice(0, 10),
    membershipExpiryDate: '',
    annualPremiumAmount: '',
    premiumCurrency: 'USD',
    premiumFrequency: 'annual',
    indigentStatus: false,
    waiverType: '',
    waiverPercentage: '',
    waiverSponsor: '',
    phone: '',
  });

  const [memberForm, setMemberForm] = useState({
    patientId: '',
    memberNumber: '',
    relationshipToHead: 'child',
    joinedDate: new Date().toISOString().slice(0, 10),
  });

  const [contributionForm, setContributionForm] = useState({
    householdId: '',
    paymentDate: new Date().toISOString().slice(0, 10),
    periodCoveredFrom: new Date().toISOString().slice(0, 10),
    periodCoveredTo: new Date().toISOString().slice(0, 10),
    amountPaid: '',
    currency: 'USD',
    subsidyAmount: '0',
    memberContribution: '',
    paymentMethod: 'mobile_money',
    mobileMoneyRef: '',
    receiptNumber: '',
    notes: '',
  });

  const [claimForm, setClaimForm] = useState({
    householdId: '',
    patientId: '',
    schemeId: '',
    encounterId: '',
    admissionDate: '',
    dischargeDate: '',
    principalDiagnosisIcd: '',
    secondaryDiagnoses: '',
    proceduresJson: '[{"code":"","description":"","quantity":1,"unit_cost":0}]',
    totalBilled: '',
    claimedAmount: '',
    coPaymentAmount: '0',
  });

  const loadData = useCallback(async () => {
    try {
      const [householdRows, claimRows] = await Promise.all([
        cbhiApi.getHouseholds(schemeIdFilter || undefined, token, tenantSlug),
        cbhiApi.getClaims({ schemeId: schemeIdFilter || undefined, status: claimStatusFilter || undefined }, token, tenantSlug),
      ]);
      setHouseholds(Array.isArray(householdRows) ? householdRows : []);
      setClaims(Array.isArray(claimRows) ? claimRows : []);
      if (selectedHouseholdId) {
        const detail = await cbhiApi.getHousehold(selectedHouseholdId, token, tenantSlug);
        setSelectedHousehold(detail);
      }
      if (schemeIdFilter) {
        const summaryRow = await cbhiApi.getCbhiSummary(schemeIdFilter, token, tenantSlug);
        setSummary(summaryRow);
      } else {
        setSummary(null);
      }
    } catch (error: any) {
      showError('CBHI', error?.response?.data?.message || 'Failed to load CBHI data.');
    }
  }, [claimStatusFilter, schemeIdFilter, selectedHouseholdId, showError, tenantSlug, token]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const selectedHouseholdBalance = useMemo(() => {
    const contributions = Array.isArray(selectedHousehold?.contributions) ? selectedHousehold.contributions : [];
    return contributions.reduce((sum: number, item: any) => sum + Number(item.amountPaid || 0), 0);
  }, [selectedHousehold]);

  const registerHousehold = async () => {
    try {
      await cbhiApi.registerHousehold(
        {
          ...householdForm,
          headOfHouseholdPatientId: householdForm.headOfHouseholdPatientId || null,
          membershipExpiryDate: householdForm.membershipExpiryDate || null,
          annualPremiumAmount: householdForm.annualPremiumAmount ? Number(householdForm.annualPremiumAmount) : null,
          indigentStatus: householdForm.indigentStatus,
          waiverType: householdForm.waiverType || null,
          waiverPercentage: householdForm.waiverPercentage ? Number(householdForm.waiverPercentage) : null,
          waiverSponsor: householdForm.waiverSponsor || null,
          phone: householdForm.phone || null,
        },
        token,
        tenantSlug,
      );
      showSuccess('CBHI', 'Household registered successfully.');
      await loadData();
    } catch (error: any) {
      showError('CBHI', error?.response?.data?.message || 'Failed to register household.');
    }
  };

  const addMember = async () => {
    if (!selectedHouseholdId) {
      showError('CBHI', 'Select a household before adding members.');
      return;
    }
    try {
      await cbhiApi.addMember(selectedHouseholdId, memberForm, token, tenantSlug);
      showSuccess('CBHI', 'Household member added.');
      const detail = await cbhiApi.getHousehold(selectedHouseholdId, token, tenantSlug);
      setSelectedHousehold(detail);
      await loadData();
    } catch (error: any) {
      showError('CBHI', error?.response?.data?.message || 'Failed to add household member.');
    }
  };

  const verifyMember = async () => {
    try {
      const result = await cbhiApi.verifyMembership(verifyPatientId, token, tenantSlug);
      setVerification(result);
    } catch (error: any) {
      showError('CBHI', error?.response?.data?.message || 'Failed to verify membership.');
    }
  };

  const recordContribution = async () => {
    try {
      await cbhiApi.recordContribution(
        {
          ...contributionForm,
          amountPaid: Number(contributionForm.amountPaid || 0),
          subsidyAmount: Number(contributionForm.subsidyAmount || 0),
          memberContribution: Number(contributionForm.memberContribution || 0),
          mobileMoneyRef: contributionForm.mobileMoneyRef || null,
          receiptNumber: contributionForm.receiptNumber || null,
          notes: contributionForm.notes || null,
        },
        token,
        tenantSlug,
      );
      showSuccess('CBHI', 'Contribution recorded.');
      await loadData();
    } catch (error: any) {
      showError('CBHI', error?.response?.data?.message || 'Failed to record contribution.');
    }
  };

  const submitClaim = async () => {
    try {
      await cbhiApi.submitClaim(
        {
          ...claimForm,
          encounterId: claimForm.encounterId || null,
          admissionDate: claimForm.admissionDate || null,
          dischargeDate: claimForm.dischargeDate || null,
          secondaryDiagnoses: claimForm.secondaryDiagnoses.split(',').map((item) => item.trim()).filter(Boolean),
          procedures: JSON.parse(claimForm.proceduresJson || '[]'),
          totalBilled: Number(claimForm.totalBilled || 0),
          claimedAmount: Number(claimForm.claimedAmount || 0),
          coPaymentAmount: Number(claimForm.coPaymentAmount || 0),
        },
        token,
        tenantSlug,
      );
      showSuccess('CBHI', 'Claim submitted and sent for AI adjudication.');
      await loadData();
    } catch (error: any) {
      showError('CBHI', error?.response?.data?.message || 'Failed to submit claim.');
    }
  };

  const adjudicateClaim = async (claim: any, status: string) => {
    try {
      await cbhiApi.adjudicateClaim(
        claim.id,
        {
          status,
          approvedAmount: Number(claim.approvedAmount || claim.claimedAmount || 0),
          rejectionReason: status === 'rejected' ? (claim.rejectionReason || 'Manual rejection') : null,
        },
        token,
        tenantSlug,
      );
      showSuccess('CBHI', 'Claim adjudicated.');
      await loadData();
    } catch (error: any) {
      showError('CBHI', error?.response?.data?.message || 'Failed to adjudicate claim.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 md:px-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-cyan-300">Sprint 154</p>
          <h1 className="text-3xl font-semibold text-white">CBHI Deep Module</h1>
          <p className="mt-1 text-sm text-slate-400">
            Household registry, contributions, exemptions, and claims adjudication AI.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            { key: 'households', label: 'Households', icon: Users },
            { key: 'contributions', label: 'Contributions', icon: CreditCard },
            { key: 'claims', label: 'Claims', icon: AlertTriangle },
            { key: 'summary', label: 'Summary', icon: ShieldCheck },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key as TabKey)}
              className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium ${
                tab === item.key
                  ? 'border-cyan-500 bg-cyan-500/15 text-cyan-100'
                  : 'border-slate-700 bg-slate-900/80 text-slate-300 hover:border-slate-600'
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </button>
          ))}
        </div>

        {tab === 'households' && (
          <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
              <h2 className="text-lg font-semibold text-white">Register Household</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <input value={householdForm.householdId} onChange={(e) => setHouseholdForm((p) => ({ ...p, householdId: e.target.value }))} placeholder="Household ID" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                <input value={householdForm.schemeId} onChange={(e) => setHouseholdForm((p) => ({ ...p, schemeId: e.target.value }))} placeholder="Scheme ID" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                <input value={householdForm.schemeName} onChange={(e) => setHouseholdForm((p) => ({ ...p, schemeName: e.target.value }))} placeholder="Scheme name" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                <input value={householdForm.householdName} onChange={(e) => setHouseholdForm((p) => ({ ...p, householdName: e.target.value }))} placeholder="Household name" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                <input value={householdForm.headOfHouseholdPatientId} onChange={(e) => setHouseholdForm((p) => ({ ...p, headOfHouseholdPatientId: e.target.value }))} placeholder="Head patient ID" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                <input value={householdForm.phone} onChange={(e) => setHouseholdForm((p) => ({ ...p, phone: e.target.value }))} placeholder="Phone" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                <input value={householdForm.village} onChange={(e) => setHouseholdForm((p) => ({ ...p, village: e.target.value }))} placeholder="Village" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                <input value={householdForm.ward} onChange={(e) => setHouseholdForm((p) => ({ ...p, ward: e.target.value }))} placeholder="Ward" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                <input value={householdForm.district} onChange={(e) => setHouseholdForm((p) => ({ ...p, district: e.target.value }))} placeholder="District" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                <input type="date" value={householdForm.membershipStartDate} onChange={(e) => setHouseholdForm((p) => ({ ...p, membershipStartDate: e.target.value }))} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                <input type="date" value={householdForm.membershipExpiryDate} onChange={(e) => setHouseholdForm((p) => ({ ...p, membershipExpiryDate: e.target.value }))} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                <input value={householdForm.annualPremiumAmount} onChange={(e) => setHouseholdForm((p) => ({ ...p, annualPremiumAmount: e.target.value }))} placeholder="Annual premium" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                <input value={householdForm.waiverPercentage} onChange={(e) => setHouseholdForm((p) => ({ ...p, waiverPercentage: e.target.value }))} placeholder="Waiver %" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                <input value={householdForm.waiverType} onChange={(e) => setHouseholdForm((p) => ({ ...p, waiverType: e.target.value }))} placeholder="Waiver type" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                <input value={householdForm.waiverSponsor} onChange={(e) => setHouseholdForm((p) => ({ ...p, waiverSponsor: e.target.value }))} placeholder="Waiver sponsor" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
              </div>
              <label className="mt-3 flex items-center gap-2 text-sm text-slate-200">
                <input type="checkbox" checked={householdForm.indigentStatus} onChange={(e) => setHouseholdForm((p) => ({ ...p, indigentStatus: e.target.checked }))} />
                Indigent or waiver-supported household
              </label>
              <button type="button" onClick={registerHousehold} className="mt-4 rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400">
                Save Household
              </button>

              <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                <h3 className="text-sm font-semibold text-white">Verify Membership</h3>
                <div className="mt-3 flex gap-2">
                  <input value={verifyPatientId} onChange={(e) => setVerifyPatientId(e.target.value)} placeholder="Patient ID" className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                  <button type="button" onClick={verifyMember} className="rounded-xl border border-cyan-500/40 px-4 py-2 text-sm text-cyan-100">
                    Verify
                  </button>
                </div>
                {verification && (
                  <div className={`mt-3 rounded-xl border px-3 py-2 text-sm ${verification.active ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100' : 'border-red-500/40 bg-red-500/10 text-red-100'}`}>
                    {verification.message}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
                <div className="flex gap-2">
                  <input value={schemeIdFilter} onChange={(e) => setSchemeIdFilter(e.target.value)} placeholder="Filter by scheme ID" className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                  <button type="button" onClick={() => void loadData()} className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-200">Refresh</button>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
                <h2 className="text-lg font-semibold text-white">Household Registry</h2>
                <div className="mt-4 space-y-3">
                  {households.map((household) => (
                    <button key={household.id} type="button" onClick={async () => {
                      setSelectedHouseholdId(household.id);
                      const detail = await cbhiApi.getHousehold(household.id, token, tenantSlug);
                      setSelectedHousehold(detail);
                    }} className="block w-full rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-left hover:border-slate-700">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs ${household.membershipStatus === 'active' ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100' : household.membershipStatus === 'exempted' ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-100' : 'border-amber-500/40 bg-amber-500/10 text-amber-100'}`}>
                          {household.membershipStatus}
                        </span>
                        {household.indigentStatus && (
                          <span className="inline-flex rounded-full border border-violet-500/40 bg-violet-500/10 px-2.5 py-0.5 text-xs text-violet-100">
                            Indigent
                          </span>
                        )}
                      </div>
                      <p className="mt-2 text-sm font-medium text-white">{household.householdName}</p>
                      <p className="mt-1 text-xs text-slate-400">{household.householdId} · {household.schemeId} · {household.memberCount} members</p>
                    </button>
                  ))}
                </div>
              </div>

              {selectedHousehold && (
                <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
                  <h2 className="text-lg font-semibold text-white">Selected Household</h2>
                  <p className="mt-2 text-sm text-slate-300">Premium paid total: {selectedHouseholdBalance.toFixed(2)} {selectedHousehold.premiumCurrency || 'USD'}</p>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <input value={memberForm.patientId} onChange={(e) => setMemberForm((p) => ({ ...p, patientId: e.target.value }))} placeholder="Patient ID" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                    <input value={memberForm.memberNumber} onChange={(e) => setMemberForm((p) => ({ ...p, memberNumber: e.target.value }))} placeholder="Member number" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                    <select value={memberForm.relationshipToHead} onChange={(e) => setMemberForm((p) => ({ ...p, relationshipToHead: e.target.value }))} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm">
                      <option value="head">Head</option>
                      <option value="spouse">Spouse</option>
                      <option value="child">Child</option>
                      <option value="dependent">Dependent</option>
                    </select>
                    <input type="date" value={memberForm.joinedDate} onChange={(e) => setMemberForm((p) => ({ ...p, joinedDate: e.target.value }))} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                  </div>
                  <button type="button" onClick={addMember} className="mt-4 rounded-xl border border-cyan-500/40 px-4 py-2 text-sm text-cyan-100">
                    Add Member
                  </button>
                  <div className="mt-4 space-y-2">
                    {(selectedHousehold.members || []).map((member: any) => (
                      <div key={member.id} className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-200">
                        {member.patientId} · {member.relationshipToHead} · {member.memberStatus}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'contributions' && (
          <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
              <h2 className="text-lg font-semibold text-white">Record Contribution</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <input value={contributionForm.householdId} onChange={(e) => setContributionForm((p) => ({ ...p, householdId: e.target.value }))} placeholder="Household ID" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                <input type="date" value={contributionForm.paymentDate} onChange={(e) => setContributionForm((p) => ({ ...p, paymentDate: e.target.value }))} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                <input type="date" value={contributionForm.periodCoveredFrom} onChange={(e) => setContributionForm((p) => ({ ...p, periodCoveredFrom: e.target.value }))} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                <input type="date" value={contributionForm.periodCoveredTo} onChange={(e) => setContributionForm((p) => ({ ...p, periodCoveredTo: e.target.value }))} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                <input value={contributionForm.amountPaid} onChange={(e) => setContributionForm((p) => ({ ...p, amountPaid: e.target.value }))} placeholder="Amount paid" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                <input value={contributionForm.memberContribution} onChange={(e) => setContributionForm((p) => ({ ...p, memberContribution: e.target.value }))} placeholder="Member contribution" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                <input value={contributionForm.subsidyAmount} onChange={(e) => setContributionForm((p) => ({ ...p, subsidyAmount: e.target.value }))} placeholder="Subsidy amount" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                <select value={contributionForm.paymentMethod} onChange={(e) => setContributionForm((p) => ({ ...p, paymentMethod: e.target.value }))} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm">
                  <option value="cash">Cash</option>
                  <option value="mobile_money">Mobile money</option>
                  <option value="bank_transfer">Bank transfer</option>
                  <option value="subsidy_credit">Subsidy credit</option>
                </select>
                <input value={contributionForm.mobileMoneyRef} onChange={(e) => setContributionForm((p) => ({ ...p, mobileMoneyRef: e.target.value }))} placeholder="Mobile money ref" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                <input value={contributionForm.receiptNumber} onChange={(e) => setContributionForm((p) => ({ ...p, receiptNumber: e.target.value }))} placeholder="Receipt number" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
              </div>
              <textarea value={contributionForm.notes} onChange={(e) => setContributionForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Notes" className="mt-3 min-h-[90px] w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
              <button type="button" onClick={recordContribution} className="mt-4 rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400">
                Record Contribution
              </button>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
              <h2 className="text-lg font-semibold text-white">Contribution History</h2>
              {!selectedHousehold ? (
                <p className="mt-4 text-sm text-slate-400">Select a household in the registry tab to inspect full contribution history.</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {(selectedHousehold.contributions || []).map((item: any) => (
                    <div key={item.id} className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                      <p className="text-sm text-white">{item.paymentDate} · {Number(item.amountPaid || 0).toFixed(2)} {item.currency}</p>
                      <p className="mt-1 text-xs text-slate-400">{item.paymentMethod} · {item.paymentStatus} · {item.receiptNumber || 'no receipt'}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'claims' && (
          <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
              <h2 className="text-lg font-semibold text-white">Submit Claim</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <input value={claimForm.householdId} onChange={(e) => setClaimForm((p) => ({ ...p, householdId: e.target.value }))} placeholder="Household ID" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                <input value={claimForm.patientId} onChange={(e) => setClaimForm((p) => ({ ...p, patientId: e.target.value }))} placeholder="Patient ID" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                <input value={claimForm.schemeId} onChange={(e) => setClaimForm((p) => ({ ...p, schemeId: e.target.value }))} placeholder="Scheme ID" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                <input value={claimForm.encounterId} onChange={(e) => setClaimForm((p) => ({ ...p, encounterId: e.target.value }))} placeholder="Encounter ID" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                <input type="date" value={claimForm.admissionDate} onChange={(e) => setClaimForm((p) => ({ ...p, admissionDate: e.target.value }))} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                <input type="date" value={claimForm.dischargeDate} onChange={(e) => setClaimForm((p) => ({ ...p, dischargeDate: e.target.value }))} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                <input value={claimForm.principalDiagnosisIcd} onChange={(e) => setClaimForm((p) => ({ ...p, principalDiagnosisIcd: e.target.value }))} placeholder="Principal ICD" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                <input value={claimForm.secondaryDiagnoses} onChange={(e) => setClaimForm((p) => ({ ...p, secondaryDiagnoses: e.target.value }))} placeholder="Secondary ICDs CSV" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                <input value={claimForm.totalBilled} onChange={(e) => setClaimForm((p) => ({ ...p, totalBilled: e.target.value }))} placeholder="Total billed" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                <input value={claimForm.claimedAmount} onChange={(e) => setClaimForm((p) => ({ ...p, claimedAmount: e.target.value }))} placeholder="Claimed amount" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                <input value={claimForm.coPaymentAmount} onChange={(e) => setClaimForm((p) => ({ ...p, coPaymentAmount: e.target.value }))} placeholder="Co-payment" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm md:col-span-2" />
              </div>
              <textarea value={claimForm.proceduresJson} onChange={(e) => setClaimForm((p) => ({ ...p, proceduresJson: e.target.value }))} className="mt-3 min-h-[120px] w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
              <button type="button" onClick={submitClaim} className="mt-4 rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400">
                Submit Claim
              </button>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
              <div className="flex gap-2">
                <input value={claimStatusFilter} onChange={(e) => setClaimStatusFilter(e.target.value)} placeholder="Filter by status" className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                <button type="button" onClick={() => void loadData()} className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-200">Refresh</button>
              </div>
              <div className="mt-4 space-y-3">
                {claims.map((claim) => (
                  <div key={claim.id} className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-white">{claim.claimNumber}</p>
                        <p className="mt-1 text-xs text-slate-400">{claim.schemeId} · {claim.principalDiagnosisIcd} · {claim.claimStatus}</p>
                        <p className="mt-2 text-sm text-slate-200">
                          Fraud score: {claim.cdssFraudScore !== null && claim.cdssFraudScore !== undefined ? Number(claim.cdssFraudScore).toFixed(2) : 'n/a'}
                          {claim.cdssConfidence !== null && claim.cdssConfidence !== undefined ? ` · ${(Number(claim.cdssConfidence) * 100).toFixed(0)}% confidence` : ''}
                        </p>
                        {Array.isArray(claim.cdssFlags) && claim.cdssFlags.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {claim.cdssFlags.map((flag: string) => (
                              <span key={flag} className="inline-flex rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-xs text-amber-100">
                                {flag}
                              </span>
                            ))}
                          </div>
                        )}
                        <p className="mt-2 text-sm text-cyan-100">
                          Recommended approval: {claim.approvedAmount !== null && claim.approvedAmount !== undefined ? Number(claim.approvedAmount).toFixed(2) : 'pending'}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => void adjudicateClaim(claim, 'approved')} className="rounded-lg border border-emerald-500/40 px-3 py-1.5 text-xs text-emerald-100">Approve</button>
                        <button type="button" onClick={() => void adjudicateClaim(claim, 'rejected')} className="rounded-lg border border-red-500/40 px-3 py-1.5 text-xs text-red-100">Reject</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'summary' && (
          <div className="grid gap-4 md:grid-cols-5">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
              <div className="flex items-center gap-2 text-slate-300"><Users className="h-4 w-4 text-cyan-300" /> Households</div>
              <p className="mt-3 text-3xl font-semibold text-white">{summary?.households ?? 0}</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
              <div className="flex items-center gap-2 text-slate-300"><ShieldCheck className="h-4 w-4 text-emerald-300" /> Active</div>
              <p className="mt-3 text-3xl font-semibold text-white">{summary?.activeHouseholds ?? 0}</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
              <div className="flex items-center gap-2 text-slate-300"><AlertTriangle className="h-4 w-4 text-violet-300" /> Indigent</div>
              <p className="mt-3 text-3xl font-semibold text-white">{summary?.indigent ?? 0}</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
              <div className="flex items-center gap-2 text-slate-300"><CreditCard className="h-4 w-4 text-amber-300" /> Pending claims</div>
              <p className="mt-3 text-3xl font-semibold text-white">{summary?.pendingClaims ?? 0}</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
              <div className="flex items-center gap-2 text-slate-300"><BadgeDollarSign className="h-4 w-4 text-red-300" /> Flagged</div>
              <p className="mt-3 text-3xl font-semibold text-white">{summary?.flaggedClaims ?? 0}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
