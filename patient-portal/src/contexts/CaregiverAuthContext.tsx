import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { patientPortalApi } from '../services/api';

interface CaregiverData {
  id: string;
  name: string;
  email: string;
  relationship: string;
  accessLevel: string;
}

interface PatientSummaryData {
  id: string;
  patientNumber: string;
  firstName: string;
  lastName: string;
}

interface CaregiverAuthContextType {
  caregiver: CaregiverData | null;
  patient: PatientSummaryData | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string, tenantSlug: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const CaregiverAuthContext = createContext<CaregiverAuthContextType | undefined>(undefined);

const _decodeJwtExp = (token: string): number | null => {
  try {
    const payload = token.split('.')[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof decoded.exp === 'number' ? decoded.exp : null;
  } catch {
    return null;
  }
};

const _buildLoginUrl = (): string => {
  const slug = localStorage.getItem('caregiver_tenant');
  return `/${slug || 'login'}/caregiver/login`;
};

const clearCaregiverStorage = () => {
  localStorage.removeItem('caregiver_token');
  localStorage.removeItem('caregiver_data');
  localStorage.removeItem('caregiver_patient');
};

export const CaregiverAuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [caregiver, setCaregiver] = useState<CaregiverData | null>(null);
  const [patient, setPatient] = useState<PatientSummaryData | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem('caregiver_token');
    const storedCaregiver = localStorage.getItem('caregiver_data');
    const storedPatient = localStorage.getItem('caregiver_patient');

    if (storedToken && storedCaregiver && storedPatient) {
      const exp = _decodeJwtExp(storedToken);
      if (exp !== null && Date.now() / 1000 >= exp) {
        const loginUrl = _buildLoginUrl();
        clearCaregiverStorage();
        localStorage.removeItem('caregiver_tenant');
        setLoading(false);
        window.location.href = loginUrl;
        return;
      }
      setToken(storedToken);
      setCaregiver(JSON.parse(storedCaregiver));
      setPatient(JSON.parse(storedPatient));
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    if (!token) return;
    const exp = _decodeJwtExp(token);
    if (exp === null) return;

    const id = window.setInterval(() => {
      if (Date.now() / 1000 >= exp) {
        const loginUrl = _buildLoginUrl();
        setToken(null);
        setCaregiver(null);
        setPatient(null);
        clearCaregiverStorage();
        localStorage.removeItem('caregiver_tenant');
        window.location.href = loginUrl;
      }
    }, 60_000);

    return () => window.clearInterval(id);
  }, [token]);

  const login = async (email: string, password: string, tenantSlug: string) => {
    const data = await patientPortalApi.caregiverLogin(email, password, tenantSlug);
    setToken(data.token);
    setCaregiver(data.caregiver);
    setPatient(data.patient);
    localStorage.setItem('caregiver_token', data.token);
    localStorage.setItem('caregiver_data', JSON.stringify(data.caregiver));
    localStorage.setItem('caregiver_patient', JSON.stringify(data.patient));
    localStorage.setItem('caregiver_tenant', tenantSlug);
  };

  const logout = () => {
    const loginUrl = _buildLoginUrl();
    setToken(null);
    setCaregiver(null);
    setPatient(null);
    clearCaregiverStorage();
    localStorage.removeItem('caregiver_tenant');
    window.location.href = loginUrl;
  };

  return (
    <CaregiverAuthContext.Provider
      value={{
        caregiver,
        patient,
        token,
        isAuthenticated: !!token && !!caregiver && !!patient,
        login,
        logout,
        loading,
      }}
    >
      {children}
    </CaregiverAuthContext.Provider>
  );
};

export const useCaregiverAuth = () => {
  const context = useContext(CaregiverAuthContext);
  if (context === undefined) {
    throw new Error('useCaregiverAuth must be used within a CaregiverAuthProvider');
  }
  return context;
};
