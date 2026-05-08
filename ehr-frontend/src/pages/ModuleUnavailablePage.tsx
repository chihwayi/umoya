import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function ModuleUnavailablePage() {
  const navigate = useNavigate();
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#080E1A] px-4 text-center">
      <div className="max-w-md">
        <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl border border-[#2B7FFF]/30 bg-[#2B7FFF]/10">
          <svg className="h-8 w-8 text-[#2B7FFF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-white">Not available on your plan</h1>
        <p className="mt-3 text-sm leading-6 text-[#7A9CC0]">
          This module is not enabled for your clinic's deployment mode. Contact your system administrator to upgrade your subscription or change your deployment mode.
        </p>
        <button
          onClick={() => navigate(-1)}
          className="mt-6 rounded-full bg-gradient-to-r from-[#00C896] to-[#00A87A] px-6 py-2.5 text-sm font-bold text-[#051119] hover:from-[#00D9A3]"
        >
          Go back
        </button>
      </div>
    </div>
  );
}
