import React, { useState } from 'react';
import { X, Save, Calendar, User, ChevronRight, ChevronLeft, Check } from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';

interface HIVEnrollmentModalProps {
  patientId: string;
  patientName: string;
  patientAge?: number;
  patientSex?: string;
  onClose: () => void;
  onSuccess: () => void;
  tenantSlug: string;
}

const HIVEnrollmentModal: React.FC<HIVEnrollmentModalProps> = ({
  patientId,
  patientName,
  patientAge,
  patientSex,
  onClose,
  onSuccess,
  tenantSlug
}) => {
  const { showSuccess, showError } = useNotification();
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 4;

  const [form, setForm] = useState({
    // Step 1: Basic Enrollment
    enrollmentDate: new Date().toISOString().split('T')[0],
    dateConfirmedPositive: new Date().toISOString().split('T')[0],
    baselineCd4: '',
    baselineViralLoad: '',
    baselineViralLoadUnit: 'copies/mL',
    baselineClinicalStage: 'stage1',
    baselineWhoStage: '',
    enrollmentNotes: '',
    
    // Step 2: ART Initiation Details - Registration
    oiArtNumber: '',
    dateOfRegistration: new Date().toISOString().split('T')[0],
    nameOfRegistrationHealthCentre: '',
    ageAtRegistration: patientAge?.toString() || '',
    sexAssignedAtBirth: patientSex || '',
    
    // Marital Status (multiple checkboxes)
    maritalStatusMarried: false,
    maritalStatusNeverMarried: false,
    maritalStatusWidowed: false,
    maritalStatusDivorcedSeparated: false,
    maritalStatusLivingTogether: false,
    maritalStatusMinor: false,
    
    // Patient Profile (multiple checkboxes)
    patientProfileGeneralPopulation: false,
    patientProfileSexWorker: false,
    patientProfileMsm: false,
    patientProfileWsw: false,
    patientProfilePwud: false,
    patientProfilePwid: false,
    patientProfileTransgender: false,
    patientProfileOthers: false,
    patientProfileOthersDetails: '',
    
    // Education Level
    educationLevel: '',
    
    // Step 3: Contact & Linkage Information
    physicalAddress: '',
    kraal: '',
    village: '',
    school: '',
    clinic: '',
    telephone: '',
    cellphone: '',
    workAddress: '',
    workTelephone: '',
    occupation: '',
    nextOfKinName: '',
    
    // Linkage Information (multiple checkboxes)
    linkageFromEid: false,
    linkageFromHts: false,
    linkageFromPmtct: false,
    linkageFromSti: false,
    linkageFromTbProgram: false,
    linkageFromVmmc: false,
    linkageFromOther: false,
    linkageFromOtherDetails: '',
    
    // Orphan Status (<18 years)
    orphanStatusDouble: false,
    orphanStatusSingle: false,
    orphanStatusNotOrphan: false,
    
    // Step 4: HIV Test Details & Consent
    dateFirstConfirmedHivTest: '',
    institutionNameVctPmtct: '',
    hivTestUsedAntibody: false,
    hivTestUsedPcr: false,
    
    // Reason for HIV Test (multiple checkboxes)
    reasonHivTestAntenatal: false,
    reasonHivTestPep: false,
    reasonHivTestDeathChildSpouse: false,
    reasonHivTestPrep: false,
    reasonHivTestHospitalIllness: false,
    reasonHivTestSpouseChildLt5Art: false,
    reasonHivTestOccupational: false,
    reasonHivTestTb: false,
    reasonHivTestVct: false,
    reasonHivTestOthers: false,
    reasonHivTestOthersDetails: '',
    
    confirmatoryHivTest: false,
    retestingHivForArtInitiation: false,
    
    // Medical Insurance
    medicalInsuranceSchemeName: '',
    medicalInsurancePolicyNumber: '',
    medicalInsuranceMemberName: '',
    medicalInsuranceRelationshipToMember: '',
    
    // Consent/Assent
    consentPersonalTracing: false,
    consentPersonalTracingDate: '',
    consentIndexCaseTesting: false,
    consentIndexCaseTestingDate: '',
    disclosureHivStatus: '',
    disclosureHivStatusToWhom: '',
    disclosureHivStatusFinalDate: '',
    disclosureHivStatusFinalToWhom: ''
  });

  const handleCheckboxChange = (field: string, checked: boolean) => {
    setForm(prev => ({ ...prev, [field]: checked }));
  };

  const handleSubmit = async () => {
    try {
      const token = localStorage.getItem('ehr_token');
      const currentUser = JSON.parse(localStorage.getItem('ehr_user') || '{}');
      
      if (!token) {
        showError('Error', 'Not authenticated');
        return;
      }

      setLoading(true);

      // Step 1: Create enrollment
      const enrollmentResponse = await ehrApi.enrollInHivCare({
        patientId,
        enrollmentDate: form.enrollmentDate,
        dateConfirmedPositive: form.dateConfirmedPositive,
        baselineCd4: form.baselineCd4 ? parseInt(form.baselineCd4) : null,
        baselineViralLoad: form.baselineViralLoad ? parseFloat(form.baselineViralLoad) : null,
        createdBy: currentUser.id,
        baselineClinicalStage: form.baselineClinicalStage,
        baselineWhoStage: form.baselineWhoStage,
        enrollmentNotes: form.enrollmentNotes
      }, token, tenantSlug);

      const enrollmentId = enrollmentResponse.data.id;

      // Step 2: Save ART initiation details
      await ehrApi.saveArtInitiationDetails({
        patientId,
        enrollmentId,
        oiArtNumber: form.oiArtNumber,
        dateOfRegistration: form.dateOfRegistration,
        nameOfRegistrationHealthCentre: form.nameOfRegistrationHealthCentre,
        ageAtRegistration: form.ageAtRegistration ? parseInt(form.ageAtRegistration) : null,
        sexAssignedAtBirth: form.sexAssignedAtBirth,
        maritalStatusMarried: form.maritalStatusMarried,
        maritalStatusNeverMarried: form.maritalStatusNeverMarried,
        maritalStatusWidowed: form.maritalStatusWidowed,
        maritalStatusDivorcedSeparated: form.maritalStatusDivorcedSeparated,
        maritalStatusLivingTogether: form.maritalStatusLivingTogether,
        maritalStatusMinor: form.maritalStatusMinor,
        patientProfileGeneralPopulation: form.patientProfileGeneralPopulation,
        patientProfileSexWorker: form.patientProfileSexWorker,
        patientProfileMsm: form.patientProfileMsm,
        patientProfileWsw: form.patientProfileWsw,
        patientProfilePwud: form.patientProfilePwud,
        patientProfilePwid: form.patientProfilePwid,
        patientProfileTransgender: form.patientProfileTransgender,
        patientProfileOthers: form.patientProfileOthers,
        patientProfileOthersDetails: form.patientProfileOthersDetails,
        educationLevel: form.educationLevel,
        physicalAddress: form.physicalAddress,
        kraal: form.kraal,
        village: form.village,
        school: form.school,
        clinic: form.clinic,
        telephone: form.telephone,
        cellphone: form.cellphone,
        workAddress: form.workAddress,
        workTelephone: form.workTelephone,
        occupation: form.occupation,
        nextOfKinName: form.nextOfKinName,
        linkageFromEid: form.linkageFromEid,
        linkageFromHts: form.linkageFromHts,
        linkageFromPmtct: form.linkageFromPmtct,
        linkageFromSti: form.linkageFromSti,
        linkageFromTbProgram: form.linkageFromTbProgram,
        linkageFromVmmc: form.linkageFromVmmc,
        linkageFromOther: form.linkageFromOther,
        linkageFromOtherDetails: form.linkageFromOtherDetails,
        orphanStatusDouble: form.orphanStatusDouble,
        orphanStatusSingle: form.orphanStatusSingle,
        orphanStatusNotOrphan: form.orphanStatusNotOrphan,
        dateFirstConfirmedHivTest: form.dateFirstConfirmedHivTest || null,
        institutionNameVctPmtct: form.institutionNameVctPmtct,
        hivTestUsedAntibody: form.hivTestUsedAntibody,
        hivTestUsedPcr: form.hivTestUsedPcr,
        reasonHivTestAntenatal: form.reasonHivTestAntenatal,
        reasonHivTestPep: form.reasonHivTestPep,
        reasonHivTestDeathChildSpouse: form.reasonHivTestDeathChildSpouse,
        reasonHivTestPrep: form.reasonHivTestPrep,
        reasonHivTestHospitalIllness: form.reasonHivTestHospitalIllness,
        reasonHivTestSpouseChildLt5Art: form.reasonHivTestSpouseChildLt5Art,
        reasonHivTestOccupational: form.reasonHivTestOccupational,
        reasonHivTestTb: form.reasonHivTestTb,
        reasonHivTestVct: form.reasonHivTestVct,
        reasonHivTestOthers: form.reasonHivTestOthers,
        reasonHivTestOthersDetails: form.reasonHivTestOthersDetails,
        confirmatoryHivTest: form.confirmatoryHivTest,
        retestingHivForArtInitiation: form.retestingHivForArtInitiation,
        medicalInsuranceSchemeName: form.medicalInsuranceSchemeName,
        medicalInsurancePolicyNumber: form.medicalInsurancePolicyNumber,
        medicalInsuranceMemberName: form.medicalInsuranceMemberName,
        medicalInsuranceRelationshipToMember: form.medicalInsuranceRelationshipToMember,
        consentPersonalTracing: form.consentPersonalTracing,
        consentPersonalTracingDate: form.consentPersonalTracingDate || null,
        consentIndexCaseTesting: form.consentIndexCaseTesting,
        consentIndexCaseTestingDate: form.consentIndexCaseTestingDate || null,
        disclosureHivStatus: form.disclosureHivStatus,
        disclosureHivStatusToWhom: form.disclosureHivStatusToWhom,
        disclosureHivStatusFinalDate: form.disclosureHivStatusFinalDate || null,
        disclosureHivStatusFinalToWhom: form.disclosureHivStatusFinalToWhom
      }, token, tenantSlug);

      showSuccess('Success', 'Patient enrolled in HIV care with ART initiation details');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Enrollment failed:', error);
      showError('Error', error.response?.data?.message || 'Failed to enroll patient');
    } finally {
      setLoading(false);
    }
  };

  const renderStep1 = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-slate-800 mb-4">Basic Enrollment Information</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Enrollment Date *</label>
          <input
            type="date"
            value={form.enrollmentDate}
            onChange={(e) => setForm({ ...form, enrollmentDate: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Date Confirmed Positive *</label>
          <input
            type="date"
            value={form.dateConfirmedPositive}
            onChange={(e) => setForm({ ...form, dateConfirmedPositive: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Baseline CD4 Count</label>
          <input
            type="number"
            value={form.baselineCd4}
            onChange={(e) => setForm({ ...form, baselineCd4: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
            placeholder="CD4 cells/mm³"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Baseline Viral Load</label>
          <input
            type="number"
            step="0.01"
            value={form.baselineViralLoad}
            onChange={(e) => setForm({ ...form, baselineViralLoad: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
            placeholder="Viral load"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Clinical Stage</label>
          <select
            value={form.baselineClinicalStage}
            onChange={(e) => setForm({ ...form, baselineClinicalStage: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
          >
            <option value="stage1">Stage 1</option>
            <option value="stage2">Stage 2</option>
            <option value="stage3">Stage 3</option>
            <option value="stage4">Stage 4</option>
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-2">Enrollment Notes</label>
          <textarea
            value={form.enrollmentNotes}
            onChange={(e) => setForm({ ...form, enrollmentNotes: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
            rows={3}
            placeholder="Additional enrollment notes..."
          />
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-slate-800 mb-4">Registration & Patient Profile</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">OI/ART Number</label>
          <input
            type="text"
            value={form.oiArtNumber}
            onChange={(e) => setForm({ ...form, oiArtNumber: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
            placeholder="OI/ART Number"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Date of Registration *</label>
          <input
            type="date"
            value={form.dateOfRegistration}
            onChange={(e) => setForm({ ...form, dateOfRegistration: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Name of Registration Health Centre</label>
          <input
            type="text"
            value={form.nameOfRegistrationHealthCentre}
            onChange={(e) => setForm({ ...form, nameOfRegistrationHealthCentre: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Age at Registration</label>
          <input
            type="number"
            value={form.ageAtRegistration}
            onChange={(e) => setForm({ ...form, ageAtRegistration: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Sex Assigned at Birth</label>
          <select
            value={form.sexAssignedAtBirth}
            onChange={(e) => setForm({ ...form, sexAssignedAtBirth: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">Select...</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Education Level</label>
          <select
            value={form.educationLevel}
            onChange={(e) => setForm({ ...form, educationLevel: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">Select...</option>
            <option value="None">None</option>
            <option value="Primary">Primary</option>
            <option value="Secondary">Secondary</option>
            <option value="Tertiary">Tertiary</option>
          </select>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-3">Marital Status (tick all that apply)</label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { key: 'maritalStatusMarried', label: 'Married' },
              { key: 'maritalStatusNeverMarried', label: 'Never Married' },
              { key: 'maritalStatusWidowed', label: 'Widowed' },
              { key: 'maritalStatusDivorcedSeparated', label: 'Divorced/Separated' },
              { key: 'maritalStatusLivingTogether', label: 'Living together' },
              { key: 'maritalStatusMinor', label: 'Minor (for Children)' }
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form[key as keyof typeof form] as boolean}
                  onChange={(e) => handleCheckboxChange(key, e.target.checked)}
                  className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
                />
                <span className="text-sm text-slate-700">{label}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-3">Patient Profile (tick all that apply)</label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { key: 'patientProfileGeneralPopulation', label: 'A=General Population' },
              { key: 'patientProfileSexWorker', label: 'B=Sex worker' },
              { key: 'patientProfileMsm', label: 'C=Men having sex with men (MSM)' },
              { key: 'patientProfileWsw', label: 'D=Women having sex with women (WSW)' },
              { key: 'patientProfilePwud', label: 'E=People who use drugs (PWUD)' },
              { key: 'patientProfilePwid', label: 'F=People who inject drugs (PWID)' },
              { key: 'patientProfileTransgender', label: 'G=Transgender' },
              { key: 'patientProfileOthers', label: 'H=Others' }
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form[key as keyof typeof form] as boolean}
                  onChange={(e) => handleCheckboxChange(key, e.target.checked)}
                  className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
                />
                <span className="text-sm text-slate-700">{label}</span>
              </label>
            ))}
          </div>
          {form.patientProfileOthers && (
            <div className="mt-2">
              <input
                type="text"
                value={form.patientProfileOthersDetails}
                onChange={(e) => setForm({ ...form, patientProfileOthersDetails: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                placeholder="Specify others..."
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-slate-800 mb-4">Contact Information & Linkage</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-2">Physical Address</label>
          <textarea
            value={form.physicalAddress}
            onChange={(e) => setForm({ ...form, physicalAddress: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
            rows={2}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Kraal</label>
          <input
            type="text"
            value={form.kraal}
            onChange={(e) => setForm({ ...form, kraal: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Village</label>
          <input
            type="text"
            value={form.village}
            onChange={(e) => setForm({ ...form, village: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">School</label>
          <input
            type="text"
            value={form.school}
            onChange={(e) => setForm({ ...form, school: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Clinic</label>
          <input
            type="text"
            value={form.clinic}
            onChange={(e) => setForm({ ...form, clinic: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Telephone</label>
          <input
            type="text"
            value={form.telephone}
            onChange={(e) => setForm({ ...form, telephone: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Cellphone</label>
          <input
            type="text"
            value={form.cellphone}
            onChange={(e) => setForm({ ...form, cellphone: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-2">Work Address</label>
          <textarea
            value={form.workAddress}
            onChange={(e) => setForm({ ...form, workAddress: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
            rows={2}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Work Telephone</label>
          <input
            type="text"
            value={form.workTelephone}
            onChange={(e) => setForm({ ...form, workTelephone: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Occupation</label>
          <input
            type="text"
            value={form.occupation}
            onChange={(e) => setForm({ ...form, occupation: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Next of Kin Name</label>
          <input
            type="text"
            value={form.nextOfKinName}
            onChange={(e) => setForm({ ...form, nextOfKinName: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      <div className="mt-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-3">Linkage from (tick all that apply)</label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { key: 'linkageFromEid', label: 'EID (Early Infant Diagnosis)' },
              { key: 'linkageFromHts', label: 'HTS (HIV Testing Services)' },
              { key: 'linkageFromPmtct', label: 'PMTCT' },
              { key: 'linkageFromSti', label: 'STI' },
              { key: 'linkageFromTbProgram', label: 'TB Program' },
              { key: 'linkageFromVmmc', label: 'VMMC' },
              { key: 'linkageFromOther', label: 'Other' }
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form[key as keyof typeof form] as boolean}
                  onChange={(e) => handleCheckboxChange(key, e.target.checked)}
                  className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
                />
                <span className="text-sm text-slate-700">{label}</span>
              </label>
            ))}
          </div>
          {form.linkageFromOther && (
            <div className="mt-2">
              <input
                type="text"
                value={form.linkageFromOtherDetails}
                onChange={(e) => setForm({ ...form, linkageFromOtherDetails: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                placeholder="Specify other linkage source..."
              />
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-3">Orphan Status &lt;18 years (tick appropriate)</label>
          <div className="flex gap-4">
            {[
              { key: 'orphanStatusDouble', label: 'Double (both parents deceased)' },
              { key: 'orphanStatusSingle', label: 'Single (one parent deceased)' },
              { key: 'orphanStatusNotOrphan', label: 'Not an orphan' }
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form[key as keyof typeof form] as boolean}
                  onChange={(e) => handleCheckboxChange(key, e.target.checked)}
                  className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
                />
                <span className="text-sm text-slate-700">{label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-slate-800 mb-4">HIV Test Details & Consent</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Date of First Confirmed HIV Test</label>
          <input
            type="date"
            value={form.dateFirstConfirmedHivTest}
            onChange={(e) => setForm({ ...form, dateFirstConfirmedHivTest: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Institution Name (VCT/PMTCT)</label>
          <input
            type="text"
            value={form.institutionNameVctPmtct}
            onChange={(e) => setForm({ ...form, institutionNameVctPmtct: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-3">HIV Test Used (tick appropriate)</label>
          <div className="space-y-2">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.hivTestUsedAntibody}
                onChange={(e) => handleCheckboxChange('hivTestUsedAntibody', e.target.checked)}
                className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
              />
              <span className="text-sm text-slate-700">Antibody (AB)</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.hivTestUsedPcr}
                onChange={(e) => handleCheckboxChange('hivTestUsedPcr', e.target.checked)}
                className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
              />
              <span className="text-sm text-slate-700">P.C.R. (Polymerase Chain Reaction)</span>
            </label>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-3">Confirmatory & Retesting</label>
          <div className="space-y-2">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.confirmatoryHivTest}
                onChange={(e) => handleCheckboxChange('confirmatoryHivTest', e.target.checked)}
                className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
              />
              <span className="text-sm text-slate-700">Confirmatory HIV Test</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.retestingHivForArtInitiation}
                onChange={(e) => handleCheckboxChange('retestingHivForArtInitiation', e.target.checked)}
                className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
              />
              <span className="text-sm text-slate-700">Retesting HIV for ART initiation</span>
            </label>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <label className="block text-sm font-medium text-slate-700 mb-3">Reason for HIV Test (tick all that apply)</label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { key: 'reasonHivTestAntenatal', label: 'Antenatal' },
            { key: 'reasonHivTestPep', label: 'PEP' },
            { key: 'reasonHivTestDeathChildSpouse', label: 'Death of child/spouse' },
            { key: 'reasonHivTestPrep', label: 'PrEP' },
            { key: 'reasonHivTestHospitalIllness', label: 'Hospital/Illness' },
            { key: 'reasonHivTestSpouseChildLt5Art', label: 'Spouse/child <5 on ART program' },
            { key: 'reasonHivTestOccupational', label: 'Occupational' },
            { key: 'reasonHivTestTb', label: 'TB' },
            { key: 'reasonHivTestVct', label: 'VCT' },
            { key: 'reasonHivTestOthers', label: 'Others' }
          ].map(({ key, label }) => (
            <label key={key} className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form[key as keyof typeof form] as boolean}
                onChange={(e) => handleCheckboxChange(key, e.target.checked)}
                className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
              />
              <span className="text-sm text-slate-700">{label}</span>
            </label>
          ))}
        </div>
        {form.reasonHivTestOthers && (
          <div className="mt-2">
            <input
              type="text"
              value={form.reasonHivTestOthersDetails}
              onChange={(e) => setForm({ ...form, reasonHivTestOthersDetails: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              placeholder="Specify other reason..."
            />
          </div>
        )}
      </div>

      <div className="mt-6 space-y-4">
        <div>
          <h4 className="text-md font-semibold text-slate-700 mb-3">Medical Insurance Scheme</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Scheme Name</label>
              <input
                type="text"
                value={form.medicalInsuranceSchemeName}
                onChange={(e) => setForm({ ...form, medicalInsuranceSchemeName: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Policy Number</label>
              <input
                type="text"
                value={form.medicalInsurancePolicyNumber}
                onChange={(e) => setForm({ ...form, medicalInsurancePolicyNumber: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Member's Name</label>
              <input
                type="text"
                value={form.medicalInsuranceMemberName}
                onChange={(e) => setForm({ ...form, medicalInsuranceMemberName: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Relationship to Member</label>
              <input
                type="text"
                value={form.medicalInsuranceRelationshipToMember}
                onChange={(e) => setForm({ ...form, medicalInsuranceRelationshipToMember: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
        </div>

        <div>
          <h4 className="text-md font-semibold text-slate-700 mb-3">Consent/Assent</h4>
          <div className="space-y-4">
            <div>
              <label className="flex items-center space-x-2 cursor-pointer mb-2">
                <input
                  type="checkbox"
                  checked={form.consentPersonalTracing}
                  onChange={(e) => handleCheckboxChange('consentPersonalTracing', e.target.checked)}
                  className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
                />
                <span className="text-sm font-medium text-slate-700">1. Personal tracing</span>
              </label>
              {form.consentPersonalTracing && (
                <input
                  type="date"
                  value={form.consentPersonalTracingDate}
                  onChange={(e) => setForm({ ...form, consentPersonalTracingDate: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  placeholder="Date"
                />
              )}
            </div>

            <div>
              <label className="flex items-center space-x-2 cursor-pointer mb-2">
                <input
                  type="checkbox"
                  checked={form.consentIndexCaseTesting}
                  onChange={(e) => handleCheckboxChange('consentIndexCaseTesting', e.target.checked)}
                  className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
                />
                <span className="text-sm font-medium text-slate-700">2. Index-case Testing Follow-up</span>
              </label>
              {form.consentIndexCaseTesting && (
                <input
                  type="date"
                  value={form.consentIndexCaseTestingDate}
                  onChange={(e) => setForm({ ...form, consentIndexCaseTestingDate: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  placeholder="Date"
                />
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">3. Disclosure of HIV Status</label>
              <select
                value={form.disclosureHivStatus}
                onChange={(e) => setForm({ ...form, disclosureHivStatus: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Select...</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
              {form.disclosureHivStatus === 'Yes' && (
                <div className="mt-2">
                  <input
                    type="text"
                    value={form.disclosureHivStatusToWhom}
                    onChange={(e) => setForm({ ...form, disclosureHivStatusToWhom: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    placeholder="To whom? (State relation)"
                  />
                </div>
              )}
              {form.disclosureHivStatus === 'No' && (
                <div className="mt-2 space-y-2">
                  <input
                    type="date"
                    value={form.disclosureHivStatusFinalDate}
                    onChange={(e) => setForm({ ...form, disclosureHivStatusFinalDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    placeholder="Date of final disclosure"
                  />
                  <input
                    type="text"
                    value={form.disclosureHivStatusFinalToWhom}
                    onChange={(e) => setForm({ ...form, disclosureHivStatusFinalToWhom: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    placeholder="To whom?"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case 1: return renderStep1();
      case 2: return renderStep2();
      case 3: return renderStep3();
      case 4: return renderStep4();
      default: return renderStep1();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[100000] p-4">
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl max-h-[90vh] flex flex-col">
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div>
            <h2 className="text-xl font-bold text-white">Enroll Patient in HIV Care</h2>
            <p className="text-sm text-emerald-100">Step {currentStep} of {totalSteps}</p>
          </div>
          <button onClick={onClose} className="text-white hover:text-emerald-100">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg mb-6">
            <div className="flex items-center gap-2 mb-2">
              <User className="w-5 h-5 text-emerald-600" />
              <span className="font-semibold text-emerald-900">{patientName}</span>
            </div>
            <p className="text-sm text-emerald-700">Complete all steps to enroll patient in HIV care program</p>
          </div>

          {/* Progress Steps */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              {[1, 2, 3, 4].map((step) => (
                <div key={step} className="flex items-center flex-1">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                    currentStep >= step 
                      ? 'bg-emerald-600 border-emerald-600 text-white' 
                      : 'border-slate-300 text-slate-400'
                  }`}>
                    {currentStep > step ? (
                      <Check className="w-5 h-5" />
                    ) : (
                      <span>{step}</span>
                    )}
                  </div>
                  {step < 4 && (
                    <div className={`flex-1 h-1 mx-2 ${
                      currentStep > step ? 'bg-emerald-600' : 'bg-slate-300'
                    }`} />
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-between text-xs text-slate-600 mt-2">
              <span>Basic Info</span>
              <span>Registration</span>
              <span>Contact & Linkage</span>
              <span>Test & Consent</span>
            </div>
          </div>

          {renderStepContent()}
        </div>

        <div className="flex items-center justify-between gap-3 pt-4 px-6 pb-6 border-t border-slate-200">
          <button
            onClick={() => currentStep > 1 && setCurrentStep(currentStep - 1)}
            disabled={currentStep === 1}
            className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <ChevronLeft className="w-5 h-5" />
            Previous
          </button>

          {currentStep < totalSteps ? (
            <button
              onClick={() => setCurrentStep(currentStep + 1)}
              className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2"
            >
              Next
              <ChevronRight className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2"
            >
              <Save className="w-5 h-5" />
              {loading ? 'Enrolling...' : 'Enroll Patient'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default HIVEnrollmentModal;
