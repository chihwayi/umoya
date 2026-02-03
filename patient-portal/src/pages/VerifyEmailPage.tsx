import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { useTenantSlug } from '../hooks/useTenantSlug';
import { CheckCircle, XCircle, Loader } from 'lucide-react';

const API_BASE_URL = process.env.REACT_APP_EHR_API_URL;

if (!API_BASE_URL) {
  console.error('REACT_APP_EHR_API_URL environment variable is not set');
}

const VerifyEmailPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { tenantSlug: urlTenantSlug } = useParams<{ tenantSlug: string }>();
  const tenantSlug = useTenantSlug();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const verifyEmail = async () => {
      const token = searchParams.get('token');
      const tenant = tenantSlug || urlTenantSlug || searchParams.get('tenant');

      if (!token) {
        setStatus('error');
        setMessage('Verification token is missing.');
        return;
      }

      if (!tenant) {
        setStatus('error');
        setMessage('Tenant information is missing. Please access this page through the correct tenant URL.');
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/patient-portal/verify-email?token=${token}`, {
          method: 'GET',
          headers: {
            'X-Tenant-ID': tenant,
          },
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || 'Verification failed');
        }

        setStatus('success');
        setMessage('Email verified successfully! You can now log in to the portal.');

        // Redirect to login after 3 seconds
        setTimeout(() => {
          navigate(`/${tenant}/login`);
        }, 3000);
      } catch (error: any) {
        setStatus('error');
        setMessage(error.message || 'Email verification failed. The token may be invalid or expired.');
      }
    };

    verifyEmail();
  }, [searchParams, navigate, tenantSlug]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="max-w-md w-full bg-white/80 backdrop-blur-sm rounded-2xl shadow-2xl p-10 text-center border border-white/20">
        {status === 'loading' && (
          <>
            <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-100 rounded-full mb-6">
              <Loader className="w-10 h-10 text-blue-600 animate-spin" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Verifying Email...</h2>
            <p className="text-gray-600">Please wait while we verify your email address.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-6 animate-bounce">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Email Verified!</h2>
            <p className="text-gray-600 mb-6">{message}</p>
            <p className="text-sm text-gray-500">Redirecting to login page...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="inline-flex items-center justify-center w-20 h-20 bg-red-100 rounded-full mb-6">
              <XCircle className="w-10 h-10 text-red-600" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Verification Failed</h2>
            <p className="text-gray-600 mb-6">{message}</p>
            <button
              onClick={() => {
                const currentTenant = tenantSlug || urlTenantSlug || searchParams.get('tenant');
                if (currentTenant) {
                  navigate(`/${currentTenant}/login`);
                } else {
                  navigate('/select-tenant');
                }
              }}
              className="w-full bg-indigo-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
            >
              Go to Login
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default VerifyEmailPage;

