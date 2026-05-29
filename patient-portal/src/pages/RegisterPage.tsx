import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useNavigate, useParams } from 'react-router-dom';
import { RegistrationAssessment, usePatientAuth } from '../contexts/PatientAuthContext';
import { UserPlus, Mail, Lock, Calendar, Phone, Hash, Eye, EyeOff, CheckCircle, AlertCircle, Shield } from 'lucide-react';

const DOB_REGEX = /^(\d{2})\/(\d{2})\/(\d{4})$/;

const toFieldLabel = (field: string) =>
  field
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (value) => value.toUpperCase());

const RegisterPage: React.FC = () => {
  const logoSrc = `${process.env.PUBLIC_URL || ''}/umoya.png`;
  const navigate = useNavigate();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { register, assessRegistration } = usePatientAuth();
  const [formData, setFormData] = useState({
    patientNumber: '',
    email: '',
    password: '',
    confirmPassword: '',
    dateOfBirth: '',
    phone: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [assessment, setAssessment] = useState<RegistrationAssessment | null>(null);
  const [assessmentError, setAssessmentError] = useState('');
  const [assessmentLoading, setAssessmentLoading] = useState(false);
  const [lastAssessmentKey, setLastAssessmentKey] = useState('');
  
  // Use fallback tenant if not in URL
  const effectiveTenantSlug = tenantSlug || 'demo-clinic';

  const hasValidDob = DOB_REGEX.test(formData.dateOfBirth);
  const hasAssessableIdentity =
    formData.patientNumber.trim().length >= 3 &&
    formData.email.includes('@') &&
    hasValidDob;

  useEffect(() => {
    if (!hasAssessableIdentity) {
      setAssessment(null);
      setAssessmentError('');
      setLastAssessmentKey('');
      setAssessmentLoading(false);
      return;
    }

    const assessmentKey = JSON.stringify({
      patientNumber: formData.patientNumber.trim().toUpperCase(),
      email: formData.email.trim().toLowerCase(),
      dateOfBirth: formData.dateOfBirth.trim(),
      phone: formData.phone.trim(),
    });

    if (assessmentKey === lastAssessmentKey) {
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setAssessmentLoading(true);

      try {
        const result = await assessRegistration(
          {
            patientNumber: formData.patientNumber.trim(),
            email: formData.email.trim(),
            password: formData.password,
            dateOfBirth: formData.dateOfBirth.trim(),
            phone: formData.phone.trim() || undefined,
          },
          effectiveTenantSlug,
        );

        if (cancelled) {
          return;
        }

        setAssessment(result);
        setAssessmentError('');
        setLastAssessmentKey(assessmentKey);
      } catch (err: any) {
        if (cancelled) {
          return;
        }

        setAssessment(null);
        setAssessmentError(err.message || 'Unable to review your registration details yet.');
        setLastAssessmentKey(assessmentKey);
      } finally {
        if (!cancelled) {
          setAssessmentLoading(false);
        }
      }
    }, 500);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    assessRegistration,
    effectiveTenantSlug,
    formData.dateOfBirth,
    formData.email,
    formData.password,
    formData.patientNumber,
    formData.phone,
    hasAssessableIdentity,
    lastAssessmentKey,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    // Validate date format (dd/mm/yyyy)
    if (!DOB_REGEX.test(formData.dateOfBirth)) {
      setError('Please enter date of birth in DD/MM/YYYY format');
      return;
    }

    // Validate date is valid
    const [day, month, year] = formData.dateOfBirth.split('/');
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    if (date.getDate() !== parseInt(day) || date.getMonth() !== parseInt(month) - 1 || date.getFullYear() !== parseInt(year)) {
      setError('Please enter a valid date');
      return;
    }

    setLoading(true);

    try {
      const registrationAssessment = await assessRegistration(
        {
          patientNumber: formData.patientNumber,
          email: formData.email,
          password: formData.password,
          dateOfBirth: formData.dateOfBirth,
          phone: formData.phone || undefined,
        },
        effectiveTenantSlug,
      );

      setAssessment(registrationAssessment);
      setAssessmentError('');

      if (registrationAssessment.portalAccessEnabled) {
        throw new Error('Portal access is already enabled for this patient.');
      }

      if (registrationAssessment.emailConflict) {
        throw new Error('This email is already registered to another patient.');
      }

      await register(
        {
          patientNumber: formData.patientNumber,
          email: formData.email,
          password: formData.password,
          dateOfBirth: formData.dateOfBirth,
          phone: formData.phone || undefined,
        },
        effectiveTenantSlug,
      );

      setSuccess(true);
      setTimeout(() => {
        navigate(`/${effectiveTenantSlug}/login`);
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-green-50 via-white to-emerald-50">
        <div className="max-w-md w-full bg-white/80 backdrop-blur-sm rounded-2xl shadow-2xl p-10 text-center border border-white/20">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full mb-6 shadow-lg animate-bounce">
            <CheckCircle className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-3">Registration Successful!</h2>
          <p className="text-gray-600 mb-2">
            We've sent a verification email to
          </p>
          <p className="text-indigo-600 font-semibold mb-6 break-all">{formData.email}</p>
          <div className="bg-blue-50 border-l-4 border-blue-500 rounded-lg p-4 text-left">
            <p className="text-sm text-blue-800">
              <strong>Next Steps:</strong> Please check your email and verify your account before logging in.
            </p>
          </div>
          <p className="text-sm text-gray-500 mt-6">
            Redirecting to login page in a few seconds...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Branding & Visual */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 relative overflow-hidden">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="relative z-10 flex flex-col justify-center px-12 text-white">
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="rounded-2xl bg-white/95 p-2 shadow-lg">
                <img src={logoSrc} alt="Umoya logo" className="h-12 w-auto rounded-xl" />
              </div>
              <h1 className="text-3xl font-bold">Umoya</h1>
            </div>
            <p className="text-xl text-white/90 font-light">Join thousands of patients managing their health</p>
          </div>

          <div className="space-y-6 mt-12">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center flex-shrink-0">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1">HIPAA Compliant</h3>
                <p className="text-white/80 text-sm">Your data is protected with industry-standard encryption</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center flex-shrink-0">
                <UserPlus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1">Quick Setup</h3>
                <p className="text-white/80 text-sm">Get started in minutes with your patient number</p>
              </div>
            </div>
          </div>

          {/* Decorative elements */}
          <div className="absolute top-20 right-20 w-72 h-72 bg-white/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 left-20 w-96 h-96 bg-white/5 rounded-full blur-3xl"></div>
        </div>
      </div>

      {/* Right Side - Registration Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-8 bg-gradient-to-br from-gray-50 to-blue-50 overflow-y-auto">
        <div className="w-full max-w-md my-8">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <img src={logoSrc} alt="Umoya logo" className="h-14 w-auto rounded-xl shadow-lg" />
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-2xl p-8 sm:p-10 border border-white/20">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl mb-4 shadow-lg">
                <UserPlus className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Create Your Account</h1>
              <p className="text-gray-600">Register to access your patient portal</p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg flex items-start gap-3 animate-shake">
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm font-medium text-red-800 flex-1">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Patient Number (MRN) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Hash className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    required
                    value={formData.patientNumber}
                    onChange={(e) => setFormData({ ...formData, patientNumber: e.target.value })}
                    className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-white/50 backdrop-blur-sm"
                    placeholder="Enter your patient number"
                  />
                </div>
                <p className="mt-1.5 text-xs text-gray-500">Found on your appointment card or medical records</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-white/50 backdrop-blur-sm"
                    placeholder="your.email@example.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Date of Birth <span className="text-red-500">*</span>
                  <span className="text-xs text-gray-500 ml-2">(DD/MM/YYYY)</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Calendar className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    required
                    value={formData.dateOfBirth}
                    onChange={(e) => {
                      // Format input to dd/mm/yyyy
                      let value = e.target.value.replace(/\D/g, ''); // Remove non-digits
                      if (value.length >= 2) value = value.slice(0, 2) + '/' + value.slice(2);
                      if (value.length >= 5) value = value.slice(0, 5) + '/' + value.slice(5, 9);
                      setFormData({ ...formData, dateOfBirth: value });
                    }}
                    className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-white/50 backdrop-blur-sm"
                    placeholder="DD/MM/YYYY"
                    maxLength={10}
                  />
                </div>
                <p className="mt-1.5 text-xs text-gray-500">Used to verify your identity when linking your account</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Phone <span className="text-gray-400 text-xs">(Optional)</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Phone className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-white/50 backdrop-blur-sm"
                    placeholder="+263 77 123 4567"
                  />
                </div>
              </div>

              {assessmentLoading && (
                <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3">
                  <p className="text-sm font-medium text-indigo-800">Reviewing your registration details against clinic records...</p>
                </div>
              )}

              {assessmentError && !assessmentLoading && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <p className="text-sm font-medium text-amber-900">{assessmentError}</p>
                </div>
              )}

              {assessment && !assessmentLoading && (
                <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Registration Readiness</p>
                      <p className="text-xs text-slate-600">
                        Match confirmed for {assessment.patient.firstName} {assessment.patient.lastName} ({assessment.patient.patientNumber})
                      </p>
                    </div>
                    <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">
                      {assessment.intakeAssessment.completenessScore}% complete
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="rounded-xl bg-white px-3 py-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Duplicate risk</p>
                      <p className="text-sm text-slate-900">
                        {assessment.intakeAssessment.suspectedDuplicateCount > 0
                          ? `${assessment.intakeAssessment.suspectedDuplicateCount} candidate match(es)`
                          : 'No duplicate candidates found'}
                      </p>
                    </div>
                    <div className="rounded-xl bg-white px-3 py-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Coverage status</p>
                      <p className="text-sm text-slate-900">{toFieldLabel(assessment.intakeAssessment.coverageRiskLevel)}</p>
                    </div>
                  </div>

                  <p className="text-sm text-slate-700">{assessment.intakeAssessment.frontDeskSummary}</p>

                  {assessment.portalAccessEnabled && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
                      Portal access is already enabled for this patient record.
                    </div>
                  )}

                  {assessment.emailConflict && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
                      This email is already linked to another patient portal account.
                    </div>
                  )}

                  {assessment.intakeAssessment.missingFields.length > 0 && (
                    <div className="rounded-xl bg-white px-3 py-3">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Missing intake fields</p>
                      <div className="flex flex-wrap gap-2">
                        {assessment.intakeAssessment.missingFields.map((field) => (
                          <span key={field} className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-900">
                            {toFieldLabel(field)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {(assessment.intakeAssessment.coverageFlags.length > 0 || assessment.intakeAssessment.consentMissingItems.length > 0) && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {assessment.intakeAssessment.coverageFlags.length > 0 && (
                        <div className="rounded-xl bg-white px-3 py-3">
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Coverage follow-up</p>
                          <div className="flex flex-wrap gap-2">
                            {assessment.intakeAssessment.coverageFlags.map((flag) => (
                              <span key={flag} className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-900">
                                {toFieldLabel(flag)}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {assessment.intakeAssessment.consentMissingItems.length > 0 && (
                        <div className="rounded-xl bg-white px-3 py-3">
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Consent readiness</p>
                          <div className="flex flex-wrap gap-2">
                            {assessment.intakeAssessment.consentMissingItems.map((item) => (
                              <span key={item} className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-medium text-rose-900">
                                {toFieldLabel(item)}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {assessment.intakeAssessment.duplicateCandidates.length > 0 && (
                    <div className="rounded-xl bg-white px-3 py-3">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Potential duplicate records</p>
                      <div className="space-y-2">
                        {assessment.intakeAssessment.duplicateCandidates.slice(0, 3).map((candidate) => (
                          <div key={candidate.patientId} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2">
                            <div>
                              <p className="text-sm font-medium text-slate-900">
                                {candidate.firstName} {candidate.lastName} ({candidate.patientNumber})
                              </p>
                              <p className="text-xs text-slate-600">{candidate.reasons.map(toFieldLabel).join(', ')}</p>
                            </div>
                            <div className="text-sm font-semibold text-slate-700">{Math.round(candidate.matchScore * 100)}%</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full pl-12 pr-12 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-white/50 backdrop-blur-sm"
                    placeholder="At least 8 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Confirm Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    className="w-full pl-12 pr-12 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-white/50 backdrop-blur-sm"
                    placeholder="Confirm your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || assessmentLoading}
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3.5 rounded-xl font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Creating Account...</span>
                  </>
                ) : assessmentLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Reviewing Registration...</span>
                  </>
                ) : (
                  <>
                    <span>Create Account</span>
                    <UserPlus className="w-5 h-5" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-8 text-center">
              <p className="text-sm text-gray-600">
                Already have an account?{' '}
                <Link
                  to={`/${effectiveTenantSlug}/login`}
                  className="font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
                >
                  Sign in
                </Link>
              </p>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-200">
              <p className="text-xs text-center text-gray-500">
                By registering, you agree to our{' '}
                <button type="button" className="text-indigo-600 hover:underline">Terms of Service</button> and{' '}
                <button type="button" className="text-indigo-600 hover:underline">Privacy Policy</button>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
