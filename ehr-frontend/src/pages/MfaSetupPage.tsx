import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from '../components/GlobalNotification';

const MfaSetupPage: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const { showError, showSuccess } = useNotification();
  const [code, setCode] = useState('');
  const [secret, setSecret] = useState('');
  const [otpauthUrl, setOtpauthUrl] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('ehr_token');
    const tempToken = localStorage.getItem('ehr_temp_token');
    if (!tenantSlug) return;
    if (!token && tempToken) return;
    if (!token) {
      navigate(`/ehr/${tenantSlug}`);
      return;
    }

    ehrApi.setupMfa(token, tenantSlug)
      .then((response) => {
        setSecret(response.data.secret || '');
        setOtpauthUrl(response.data.otpauthUrl || '');
      })
      .catch((err: any) => showError('MFA setup failed', err?.response?.data?.message || 'Unable to create authenticator setup.'));
  }, [navigate, showError, tenantSlug]);

  const finish = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!tenantSlug || !code.trim()) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('ehr_token');
      const tempToken = localStorage.getItem('ehr_temp_token');
      let response;
      if (token) {
        response = secret
          ? await ehrApi.enableMfa(token, tenantSlug, code.trim())
          : await ehrApi.verifyMfa(token, tenantSlug, code.trim());
      } else if (tempToken) {
        response = await ehrApi.complete2FALogin(tenantSlug, tempToken, code.trim());
      }

      const nextToken = response?.data?.token || response?.data?.accessToken;
      if (nextToken) localStorage.setItem('ehr_token', nextToken);
      if (response?.data?.user) localStorage.setItem('ehr_user', JSON.stringify(response.data.user));
      localStorage.removeItem('ehr_temp_token');
      showSuccess('MFA verified', 'Your session is protected.');
      navigate(`/ehr/${tenantSlug}/dashboard`);
    } catch (err: any) {
      showError('Invalid code', err?.response?.data?.message || 'Check your authenticator code and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#080E1A] px-4 text-[#E8F0FF]">
      <form onSubmit={finish} className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0A1525] p-6 shadow-2xl">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0AA98A]/15 text-[#7DE8CA]">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#7A9AB8]">Multi-factor authentication</p>
            <h1 className="text-xl font-bold text-white">{secret ? 'Set up authenticator' : 'Verify authenticator'}</h1>
          </div>
        </div>

        {secret && (
          <div className="mb-5 rounded-xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-sm font-semibold text-white">Secret</p>
            <p className="mt-2 break-all rounded-lg bg-[#07101D] px-3 py-2 font-mono text-sm text-[#7DE8CA]">{secret}</p>
            {otpauthUrl && <p className="mt-3 break-all text-xs leading-5 text-[#9DB2D1]">{otpauthUrl}</p>}
          </div>
        )}

        <label className="block text-sm font-semibold text-[#D8E5F8]">
          Authenticator code
          <div className="relative mt-2">
            <KeyRound className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#5D789B]" />
            <input
              className="w-full rounded-xl border border-[#253A58] bg-[#091320] py-3 pl-11 pr-4 text-white outline-none focus:border-[#3B9EFF]"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
          </div>
        </label>

        <button disabled={loading || code.trim().length < 6} className="mt-5 w-full rounded-xl bg-[#0AA98A] px-4 py-3 text-sm font-bold text-[#051119] disabled:opacity-60">
          {loading ? 'Verifying...' : 'Verify and continue'}
        </button>
      </form>
    </div>
  );
};

export default MfaSetupPage;
