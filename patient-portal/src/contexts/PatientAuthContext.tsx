import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { runtimeUrls } from '../config/runtime';

interface Patient {
  id: string;
  patientNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  dateOfBirth?: string;
  isLinked: boolean;
}

interface PatientAuthContextType {
  patient: Patient | null;
  token: string | null;
  isAuthenticated: boolean;
  isLinked: boolean;
  login: (email: string, password: string, tenantSlug: string) => Promise<void>;
  register: (data: RegisterData, tenantSlug: string) => Promise<void>;
  assessRegistration: (data: RegisterData, tenantSlug: string) => Promise<RegistrationAssessment>;
  logout: () => void;
  linkAccount: (data: LinkAccountData, tenantSlug: string) => Promise<void>;
  loading: boolean;
}

export interface RegisterData {
  patientNumber: string;
  email: string;
  password: string;
  dateOfBirth: string;
  phone?: string;
}

export interface RegistrationAssessment {
  patient: {
    id: string;
    patientNumber: string;
    firstName: string;
    lastName: string;
    email?: string | null;
    phone?: string | null;
  };
  portalAccessEnabled: boolean;
  emailConflict: boolean;
  intakeAssessment: {
    completenessScore: number;
    missingFields: string[];
    suspectedDuplicateCount: number;
    duplicateCandidates: Array<{
      patientId: string;
      patientNumber: string;
      firstName: string;
      lastName: string;
      matchScore: number;
      reasons: string[];
    }>;
    coverageRiskLevel: string;
    coverageFlags: string[];
    consentReady: boolean;
    consentMissingItems: string[];
    frontDeskSummary: string;
    nurseSummary: string;
    clinicianSummary: string;
  };
}

interface LinkAccountData {
  patientNumber: string;
  dateOfBirth: string;
  nationalId?: string;
  phone?: string;
}

const PatientAuthContext = createContext<PatientAuthContextType | undefined>(undefined);

const API_BASE_URL = runtimeUrls.ehrApi;

if (!API_BASE_URL) {
  console.warn('Patient Portal API URL is not defined');
}

export const PatientAuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [patient, setPatient] = useState<Patient | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for stored auth
    const storedToken = localStorage.getItem('patient_token');
    const storedPatient = localStorage.getItem('patient_data');

    if (storedToken && storedPatient) {
      setToken(storedToken);
      setPatient(JSON.parse(storedPatient));
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string, tenantSlug: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/patient-portal/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': tenantSlug,
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Login failed' }));
        throw new Error(errorData.message || errorData.error || `Login failed: ${response.status}`);
      }

      const data = await response.json();

      if (data.requiresVerification) {
        throw new Error('Please verify your email before logging in.');
      }

      if (!data.token) {
        throw new Error('Login response missing token');
      }

      setToken(data.token);
      const patientData = {
        ...data.patient,
        isLinked: true, // If login succeeds, account is linked
      };
      setPatient(patientData);

      localStorage.setItem('patient_token', data.token);
      localStorage.setItem('patient_data', JSON.stringify(patientData));
      localStorage.setItem('patient_tenant', tenantSlug);
    } catch (error: any) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const register = async (data: RegisterData, tenantSlug: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/patient-portal/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': tenantSlug,
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Registration failed');
      }

      return result;
    } catch (error: any) {
      throw error;
    }
  };

  const assessRegistration = async (data: RegisterData, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/register/assess`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': tenantSlug,
      },
      body: JSON.stringify(data),
    });

    const result = await response.json().catch(() => ({ message: 'Registration assessment failed' }));

    if (!response.ok) {
      throw new Error(result.message || 'Registration assessment failed');
    }

    return result as RegistrationAssessment;
  };

  const linkAccount = async (data: LinkAccountData, tenantSlug: string) => {
    if (!token) {
      throw new Error('Not authenticated');
    }

    try {
      const response = await fetch(`${API_BASE_URL}/patient-portal/link-account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': tenantSlug,
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Account linking failed');
      }

      // Update patient data
      if (patient) {
        const updatedPatient = { ...patient, isLinked: true };
        setPatient(updatedPatient);
        localStorage.setItem('patient_data', JSON.stringify(updatedPatient));
      }
    } catch (error: any) {
      throw error;
    }
  };

  const logout = () => {
    setPatient(null);
    setToken(null);
    localStorage.removeItem('patient_token');
    localStorage.removeItem('patient_data');
    localStorage.removeItem('patient_tenant');
    // Redirect to default tenant login on logout
    window.location.href = '/bulawayo-general/login';
  };

  return (
    <PatientAuthContext.Provider
      value={{
        patient,
        token,
        isAuthenticated: !!token && !!patient,
        isLinked: patient?.isLinked || false,
        login,
        register,
        assessRegistration,
        logout,
        linkAccount,
        loading,
      }}
    >
      {children}
    </PatientAuthContext.Provider>
  );
};

export const usePatientAuth = () => {
  const context = useContext(PatientAuthContext);
  if (context === undefined) {
    throw new Error('usePatientAuth must be used within a PatientAuthProvider');
  }
  return context;
};
