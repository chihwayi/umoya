const statsGrid = document.getElementById('statsGrid');
const plansTbody = document.getElementById('plansTbody');
const membersTbody = document.getElementById('membersTbody');
const claimsTbody = document.getElementById('claimsTbody');
const preauthTbody = document.getElementById('preauthTbody');
const flash = document.getElementById('flash');

const planForm = document.getElementById('planForm');
const memberForm = document.getElementById('memberForm');
const adjustForm = document.getElementById('adjustForm');
const manualClaimForm = document.getElementById('manualClaimForm');
const refreshAllBtn = document.getElementById('refreshAllBtn');

const memberPlanSelect = document.getElementById('memberPlanSelect');
const adjustMemberSelect = document.getElementById('adjustMemberSelect');

const cache = {
  plans: [],
  members: [],
  claims: [],
  preauths: [],
  dashboard: null,
};

const fmtCurrency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
});

function money(value) {
  const parsed = Number.parseFloat(String(value ?? 0));
  if (!Number.isFinite(parsed)) return 0;
  return Number(parsed.toFixed(2));
}

function safe(text) {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function showFlash(message, isError = false) {
  flash.textContent = message;
  flash.classList.remove('hidden');
  flash.style.borderColor = isError ? '#f0b4b0' : '#b6d9e1';
  flash.style.background = isError ? '#fdeceb' : '#e7f7fa';
  flash.style.color = isError ? '#8a1912' : '#0f5060';

  window.clearTimeout(showFlash._timer);
  showFlash._timer = window.setTimeout(() => flash.classList.add('hidden'), 3500);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  let body = null;
  const text = await response.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!response.ok) {
    const message = typeof body === 'object' ? body?.message || 'Request failed' : body || 'Request failed';
    throw new Error(message);
  }

  return body;
}

function renderStats() {
  const totals = cache.dashboard?.totals || {};
  const statusCounts = cache.dashboard?.statusCounts || {};

  const cards = [
    { label: 'Members', value: totals.members || 0 },
    { label: 'Plans', value: totals.plans || 0 },
    { label: 'Claims', value: totals.claims || 0 },
    { label: 'Preauths', value: totals.preauthorizations || 0 },
    { label: 'Submitted Amount', value: fmtCurrency.format(totals.submittedAmount || 0) },
    { label: 'Approved Amount', value: fmtCurrency.format(totals.approvedAmount || 0) },
    { label: 'Approved Claims', value: statusCounts.approved || 0 },
    { label: 'Rejected Claims', value: statusCounts.rejected || 0 },
  ];

  statsGrid.innerHTML = cards
    .map(
      (card) => `
      <article class="stat">
        <p class="label">${safe(card.label)}</p>
        <p class="value">${safe(card.value)}</p>
      </article>
    `,
    )
    .join('');
}

function renderPlanOptions() {
  memberPlanSelect.innerHTML = cache.plans
    .map((plan) => `<option value="${safe(plan.id)}">${safe(plan.name)} (${safe(plan.code)})</option>`)
    .join('');
}

function renderAdjustMemberOptions() {
  adjustMemberSelect.innerHTML = cache.members
    .map((member) => `<option value="${safe(member.id)}">${safe(member.memberNumber)} - ${safe(member.firstName)} ${safe(member.lastName)}</option>`)
    .join('');
}

function badge(status) {
  const normalized = String(status || '').toLowerCase();
  return `<span class="badge ${safe(normalized)}">${safe(normalized || 'unknown')}</span>`;
}

function renderPlans() {
  plansTbody.innerHTML = cache.plans
    .map(
      (plan) => `
      <tr>
        <td>
          <strong>${safe(plan.name)}</strong><br />
          <small>${safe(plan.code)}</small>
        </td>
        <td>
          Coverage ${safe(plan.coveragePercent)}%<br />
          Co-pay ${safe(plan.copayPercent)}%
        </td>
        <td>
          Annual ${fmtCurrency.format(money(plan.annualLimit))}<br />
          OPD ${fmtCurrency.format(money(plan.outpatientLimit))} / IPD ${fmtCurrency.format(money(plan.inpatientLimit))}<br />
          Per claim ${fmtCurrency.format(money(plan.perClaimLimit))}
        </td>
        <td>${badge(plan.status)}</td>
      </tr>
    `,
    )
    .join('');
}

function renderMembers() {
  membersTbody.innerHTML = cache.members
    .map((member) => {
      const remaining = member.remaining || {};
      return `
      <tr>
        <td>
          <strong>${safe(member.memberNumber)}</strong><br />
          ${safe(member.firstName)} ${safe(member.lastName)}<br />
          <small>${safe(member.policyNumber || '')}</small>
        </td>
        <td>
          ${safe(member.planName || member.planId || '')}<br />
          <small>${safe(member.relationship || 'self')}</small>
        </td>
        <td>${badge(member.status)}</td>
        <td>
          Annual ${fmtCurrency.format(money(remaining.annualRemaining || 0))}<br />
          OPD ${fmtCurrency.format(money(remaining.outpatientRemaining || 0))} / IPD ${fmtCurrency.format(money(remaining.inpatientRemaining || 0))}
        </td>
      </tr>
    `;
    })
    .join('');
}

function renderClaims() {
  claimsTbody.innerHTML = cache.claims
    .map(
      (claim) => `
      <tr>
        <td>
          <strong>${safe(claim.externalClaimId)}</strong><br />
          <small>${safe(claim.claimType || 'outpatient')}</small>
        </td>
        <td>
          ${safe(claim.memberNumber || '')}<br />
          <small>${safe(claim.memberName || 'Unknown member')}</small>
        </td>
        <td>
          Submitted ${fmtCurrency.format(money(claim.claimAmount || 0))}<br />
          Approved ${fmtCurrency.format(money(claim.approvedAmount || 0))}<br />
          <small>${safe(claim.rejectionReason || '')}</small>
        </td>
        <td>${badge(claim.status)}</td>
        <td>
          <div class="inline-actions" data-claim-id="${safe(claim.externalClaimId)}">
            <select class="claim-status">
              ${['submitted', 'processing', 'suspended', 'approved', 'rejected', 'paid']
                .map((status) => `<option value="${status}" ${status === claim.status ? 'selected' : ''}>${status}</option>`)
                .join('')}
            </select>
            <input class="claim-approved" type="number" step="0.01" value="${safe(claim.approvedAmount || 0)}" placeholder="Approved amount" />
            <input class="claim-reason" value="${safe(claim.rejectionReason || '')}" placeholder="Reason / note" />
            <button type="button" class="claim-update-btn">Update</button>
          </div>
        </td>
      </tr>
    `,
    )
    .join('');
}

function renderPreauths() {
  preauthTbody.innerHTML = cache.preauths
    .map(
      (item) => `
      <tr>
        <td>
          <strong>${safe(item.preAuthId)}</strong><br />
          <small>${safe(item.requestType || '')}</small>
        </td>
        <td>
          ${safe(item.memberNumber || '')}<br />
          <small>${safe(item.memberName || '')}</small>
        </td>
        <td>
          Requested ${fmtCurrency.format(money(item.requestedAmount || 0))}<br />
          Approved ${fmtCurrency.format(money(item.approvedAmount || 0))}
        </td>
        <td>
          ${badge(item.status)}<br />
          <small>${safe(item.decisionReason || '')}</small>
        </td>
      </tr>
    `,
    )
    .join('');
}

async function loadData() {
  const [dashboard, plans, members, claims, preauths] = await Promise.all([
    api('/api/dashboard'),
    api('/api/plans'),
    api('/api/members'),
    api('/api/claims'),
    api('/api/preauths'),
  ]);

  cache.dashboard = dashboard;
  cache.plans = plans || [];
  cache.members = members || [];
  cache.claims = claims || [];
  cache.preauths = preauths || [];

  renderStats();
  renderPlanOptions();
  renderAdjustMemberOptions();
  renderPlans();
  renderMembers();
  renderClaims();
  renderPreauths();
}

planForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const payload = Object.fromEntries(new FormData(planForm).entries());
  try {
    await api('/api/plans', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    planForm.reset();
    showFlash('Plan created.');
    await loadData();
  } catch (error) {
    showFlash(error.message, true);
  }
});

memberForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const payload = Object.fromEntries(new FormData(memberForm).entries());

  try {
    await api('/api/members', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    memberForm.reset();
    showFlash('Member created.');
    await loadData();
  } catch (error) {
    showFlash(error.message, true);
  }
});

adjustForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const payload = Object.fromEntries(new FormData(adjustForm).entries());
  const memberId = payload.memberId;
  delete payload.memberId;

  Object.keys(payload).forEach((key) => {
    if (payload[key] === '') {
      delete payload[key];
    }
  });

  try {
    await api(`/api/members/${memberId}/adjust-limits`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    showFlash('Member limits updated.');
    await loadData();
  } catch (error) {
    showFlash(error.message, true);
  }
});

manualClaimForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const payload = Object.fromEntries(new FormData(manualClaimForm).entries());
  const serviceCodes = String(payload.serviceCodes || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  const claimBody = {
    memberNumber: payload.memberNumber,
    claimAmount: payload.claimAmount,
    primaryDiagnosisCode: payload.primaryDiagnosisCode,
    serviceCodes,
    claimData: {
      claimType: payload.claimType,
      source: 'portal-manual',
    },
  };

  try {
    await api('/api/claims', {
      method: 'POST',
      body: JSON.stringify(claimBody),
    });
    manualClaimForm.reset();
    showFlash('Manual claim submitted.');
    await loadData();
  } catch (error) {
    showFlash(error.message, true);
  }
});

claimsTbody.addEventListener('click', async (event) => {
  const button = event.target.closest('.claim-update-btn');
  if (!button) return;

  const container = button.closest('.inline-actions');
  const claimId = container?.dataset?.claimId;
  if (!claimId) return;

  const status = container.querySelector('.claim-status')?.value;
  const approvedAmount = container.querySelector('.claim-approved')?.value;
  const note = container.querySelector('.claim-reason')?.value;

  const payload = {
    status,
    approvedAmount,
    note,
  };

  if (status === 'rejected') {
    payload.rejectionReason = note || 'Rejected from provider UI';
  }

  try {
    await api(`/api/claims/${claimId}/status`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    showFlash(`Claim ${claimId} updated.`);
    await loadData();
  } catch (error) {
    showFlash(error.message, true);
  }
});

refreshAllBtn.addEventListener('click', async () => {
  try {
    await loadData();
    showFlash('Refreshed.');
  } catch (error) {
    showFlash(error.message, true);
  }
});

loadData().catch((error) => {
  showFlash(error.message, true);
});

window.setInterval(() => {
  loadData().catch(() => {});
}, 30000);
