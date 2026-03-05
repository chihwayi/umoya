type AnyRecord = Record<string, any>;

export type DuplicateGuardPrompt = {
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
};

const normalizeText = (value: unknown): string =>
  String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();

const normalizeDateOnly = (value: unknown): string | null => {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  return raw.slice(0, 10);
};

const isWithinLastDays = (value: unknown, days: number): boolean => {
  if (!value) return false;
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return false;
  const now = Date.now();
  const diffMs = now - parsed.getTime();
  return diffMs >= 0 && diffMs <= days * 24 * 60 * 60 * 1000;
};

const toLocalDateTimeInputValue = (date: Date = new Date()): string => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};

export const buildSharedContextTags = (context: AnyRecord | null | undefined): string[] => {
  if (!context) return [];
  const tags: string[] = [];
  const hivEnrollment = context?.modules?.hiv?.latestEnrollment;
  const maternityEnrollment = context?.modules?.maternity?.latestEnrollment;
  const oncologyCase = context?.modules?.oncology?.latestCase;
  const cardiologyEncounter = context?.modules?.cardiology?.latestEncounter;
  const ophthalmologyEncounter = context?.modules?.ophthalmology?.latestEncounter;
  const edVisit = context?.modules?.ed?.latestVisit;
  const sepsisBundle = context?.modules?.sepsis?.latestBundle;
  const telemedicineConsultation = context?.modules?.telemedicine?.latestConsultation;
  const labCriticalAlert = context?.modules?.lab?.latestCriticalAlert;
  const imagingReport = context?.modules?.imaging?.latestReport;
  const pharmacyPrescription = context?.modules?.pharmacy?.latestPrescription;
  const latestVitals = context?.latestVitals;

  if (hivEnrollment?.enrollment_number) {
    tags.push(`HIV ${hivEnrollment.enrollment_number}`);
  }
  if (maternityEnrollment?.enrollment_number) {
    tags.push(`Maternity ${maternityEnrollment.enrollment_number}`);
  }
  if (oncologyCase?.id) {
    tags.push(`Oncology ${oncologyCase.id}`);
  }
  if (cardiologyEncounter?.id) {
    tags.push(`Cardiology ${cardiologyEncounter.id}`);
  }
  if (ophthalmologyEncounter?.id) {
    tags.push(`Ophthalmology ${ophthalmologyEncounter.id}`);
  }
  if (edVisit?.ed_visit_number) {
    tags.push(`ED ${edVisit.ed_visit_number}`);
  }
  if (sepsisBundle?.id) {
    tags.push(`Sepsis ${sepsisBundle.id}`);
  }
  if (telemedicineConsultation?.id) {
    tags.push(`Telemedicine ${telemedicineConsultation.id}`);
  }
  if (labCriticalAlert?.id) {
    tags.push(`Lab Alert ${labCriticalAlert.id}`);
  }
  if (imagingReport?.id) {
    tags.push(`Imaging ${imagingReport.id}`);
  }
  if (pharmacyPrescription?.prescription_number) {
    tags.push(`Rx ${pharmacyPrescription.prescription_number}`);
  }
  if (latestVitals?.recordedAt) {
    tags.push(`Vitals ${String(latestVitals.recordedAt).slice(0, 10)}`);
  }

  return tags;
};

export const getOncologyCreateCasePrefill = (
  context: AnyRecord | null | undefined,
  currentUserId?: string,
): {
  primaryDiagnosis?: string;
  diagnosisDate?: string;
  oncologistId?: string;
  carePlan?: string;
} => {
  if (!context) {
    return { oncologistId: currentUserId || undefined };
  }

  const latestOncologyCase = context?.modules?.oncology?.latestCase;
  const latestHivEnrollment = context?.modules?.hiv?.latestEnrollment;
  const latestMaternityEnrollment = context?.modules?.maternity?.latestEnrollment;
  const latestVitals = context?.latestVitals;

  const carePlanLines: string[] = [];
  if (latestHivEnrollment?.enrollment_number) {
    carePlanLines.push(
      `HIV: ${latestHivEnrollment.enrollment_status || 'unknown'} enrollment ${latestHivEnrollment.enrollment_number}`,
    );
  }
  if (latestMaternityEnrollment?.enrollment_number) {
    carePlanLines.push(
      `Maternity: ${latestMaternityEnrollment.enrollment_status || 'unknown'} enrollment ${latestMaternityEnrollment.enrollment_number}`,
    );
  }
  if (latestOncologyCase?.id) {
    carePlanLines.push(`Previous oncology case: ${latestOncologyCase.id} (${latestOncologyCase.status || 'unknown'})`);
  }
  if (latestVitals?.recordedAt) {
    carePlanLines.push(`Latest vitals captured: ${String(latestVitals.recordedAt).slice(0, 10)}`);
  }

  return {
    primaryDiagnosis: latestOncologyCase?.primary_diagnosis || undefined,
    diagnosisDate: normalizeDateOnly(latestOncologyCase?.diagnosis_date || latestHivEnrollment?.date_confirmed_positive) || undefined,
    oncologistId: currentUserId || latestOncologyCase?.oncologist_id || undefined,
    carePlan: carePlanLines.length ? `Auto context summary:\n- ${carePlanLines.join('\n- ')}` : undefined,
  };
};

export const getOphthalmologyCreateEncounterPrefill = (
  context: AnyRecord | null | undefined,
  currentUserId?: string,
): {
  encounterDateTime: string;
  ophthalmologistId?: string;
  chiefComplaint?: string;
  assessment?: string;
  plan?: string;
} => {
  const latestVitals = context?.latestVitals;
  const latestOncologyCase = context?.modules?.oncology?.latestCase;
  const latestHivEnrollment = context?.modules?.hiv?.latestEnrollment;
  const latestMaternityEnrollment = context?.modules?.maternity?.latestEnrollment;
  const latestCardiologyEncounter = context?.modules?.cardiology?.latestEncounter;

  const chiefComplaintParts: string[] = [];
  if (latestVitals?.bloodPressure) {
    chiefComplaintParts.push(`Latest BP: ${latestVitals.bloodPressure}`);
  }
  if (latestCardiologyEncounter?.visit_reason) {
    chiefComplaintParts.push(`Cardiology reason: ${latestCardiologyEncounter.visit_reason}`);
  }

  const assessmentLines: string[] = [];
  if (latestOncologyCase?.primary_diagnosis) {
    assessmentLines.push(`Oncology diagnosis: ${latestOncologyCase.primary_diagnosis}`);
  }
  if (latestHivEnrollment?.enrollment_number) {
    assessmentLines.push(`HIV enrollment: ${latestHivEnrollment.enrollment_number}`);
  }

  const planLines: string[] = [];
  if (latestMaternityEnrollment?.enrollment_status === 'active') {
    planLines.push('Coordinate review schedule with active maternity care plan.');
  }
  if (latestCardiologyEncounter?.follow_up_plan) {
    planLines.push(`Cardiology follow-up: ${latestCardiologyEncounter.follow_up_plan}`);
  }

  return {
    encounterDateTime: toLocalDateTimeInputValue(),
    ophthalmologistId: currentUserId || undefined,
    chiefComplaint: chiefComplaintParts.length ? chiefComplaintParts.join(' | ') : undefined,
    assessment: assessmentLines.length ? assessmentLines.join('\n') : undefined,
    plan: planLines.length ? planLines.join('\n') : undefined,
  };
};

export const getCardiologyCreateEncounterPrefill = (
  context: AnyRecord | null | undefined,
): {
  encounterType?: string;
  riskScore?: string;
  visitReason?: string;
  symptoms?: string;
  carePlan?: string;
  followUpPlan?: string;
  bloodPressure?: string;
} => {
  if (!context) return {};

  const latestCardiologyEncounter = context?.modules?.cardiology?.latestEncounter;
  const latestEdVisit = context?.modules?.ed?.latestVisit;
  const latestOphthalmologyEncounter = context?.modules?.ophthalmology?.latestEncounter;
  const latestOncologyCase = context?.modules?.oncology?.latestCase;
  const latestSepsisScreening = context?.modules?.sepsis?.latestScreening;
  const latestVitals = context?.latestVitals;

  const carePlanLines: string[] = [];
  if (latestCardiologyEncounter?.follow_up_plan) {
    carePlanLines.push(`Prior cardiology follow-up: ${latestCardiologyEncounter.follow_up_plan}`);
  }
  if (latestOncologyCase?.primary_diagnosis) {
    carePlanLines.push(`Oncology history: ${latestOncologyCase.primary_diagnosis}`);
  }
  if (latestSepsisScreening?.sepsis_suspected) {
    carePlanLines.push('Recent sepsis screening flagged suspicion; include infection risk review.');
  }

  const riskScore =
    latestCardiologyEncounter?.risk_score ||
    (latestSepsisScreening?.sepsis_suspected ? 'high' : undefined);

  return {
    encounterType: latestCardiologyEncounter?.encounter_type || undefined,
    riskScore,
    visitReason:
      latestCardiologyEncounter?.visit_reason ||
      latestEdVisit?.chief_complaint ||
      latestOphthalmologyEncounter?.chief_complaint ||
      undefined,
    symptoms: latestEdVisit?.chief_complaint || undefined,
    carePlan: carePlanLines.length ? carePlanLines.join('\n') : undefined,
    followUpPlan: latestCardiologyEncounter?.follow_up_plan || undefined,
    bloodPressure: latestVitals?.bloodPressure || undefined,
  };
};

export const getOncologyCreateCaseDuplicateGuard = (
  context: AnyRecord | null | undefined,
  draft: {
    primaryDiagnosis?: string | null;
    diagnosisDate?: string | null;
  },
): DuplicateGuardPrompt | null => {
  const latestCase = context?.modules?.oncology?.latestCase;
  if (!latestCase) return null;

  const sameDiagnosis =
    normalizeText(draft.primaryDiagnosis) &&
    normalizeText(draft.primaryDiagnosis) === normalizeText(latestCase.primary_diagnosis);
  const sameDiagnosisDate =
    normalizeDateOnly(draft.diagnosisDate) &&
    normalizeDateOnly(draft.diagnosisDate) === normalizeDateOnly(latestCase.diagnosis_date);
  const isActive = String(latestCase.status || '').toLowerCase() === 'active';

  if (!sameDiagnosis || (!sameDiagnosisDate && !isActive)) {
    return null;
  }

  return {
    title: 'Possible Duplicate Oncology Case',
    message: `A recent oncology case (${latestCase.id || 'existing'}) already has the same diagnosis. Continue anyway to create another case?`,
    confirmText: 'Create New Case',
    cancelText: 'Review Existing Case',
  };
};

export const getOphthalmologyEncounterDuplicateGuard = (
  context: AnyRecord | null | undefined,
  draft: {
    encounterType?: string | null;
    chiefComplaint?: string | null;
  },
): DuplicateGuardPrompt | null => {
  const latestEncounter = context?.modules?.ophthalmology?.latestEncounter;
  if (!latestEncounter) return null;

  const sameType =
    normalizeText(draft.encounterType) &&
    normalizeText(draft.encounterType) === normalizeText(latestEncounter.encounter_type);
  const sameComplaint =
    normalizeText(draft.chiefComplaint) &&
    normalizeText(draft.chiefComplaint) === normalizeText(latestEncounter.chief_complaint);
  const recent = isWithinLastDays(latestEncounter.encounter_date, 30);

  if (!sameType || !sameComplaint || !recent) {
    return null;
  }

  return {
    title: 'Possible Duplicate Ophthalmology Encounter',
    message: 'A matching ophthalmology encounter exists in the last 30 days. Continue and create another encounter?',
    confirmText: 'Create Encounter',
    cancelText: 'Review Existing',
  };
};

export const getCardiologyEncounterDuplicateGuard = (
  context: AnyRecord | null | undefined,
  draft: {
    encounterType?: string | null;
    visitReason?: string | null;
    riskScore?: string | null;
  },
): DuplicateGuardPrompt | null => {
  const latestEncounter = context?.modules?.cardiology?.latestEncounter;
  if (!latestEncounter) return null;

  const sameType =
    normalizeText(draft.encounterType) &&
    normalizeText(draft.encounterType) === normalizeText(latestEncounter.encounter_type);
  const sameReason =
    normalizeText(draft.visitReason) &&
    normalizeText(draft.visitReason) === normalizeText(latestEncounter.visit_reason);
  const sameRisk =
    !normalizeText(draft.riskScore) ||
    normalizeText(draft.riskScore) === normalizeText(latestEncounter.risk_score);
  const recent = isWithinLastDays(latestEncounter.encounter_date, 21);

  if (!sameType || !sameReason || !sameRisk || !recent) {
    return null;
  }

  return {
    title: 'Possible Duplicate Cardiology Encounter',
    message: 'A similar cardiology encounter already exists recently for this patient. Continue and create another encounter?',
    confirmText: 'Create Encounter',
    cancelText: 'Review Existing',
  };
};

const isEdVisitActive = (status: unknown): boolean => {
  const normalized = normalizeText(status);
  if (!normalized) return false;
  return ![
    'discharged',
    'admitted',
    'transferred',
    'deceased',
    'left_without_being_seen',
  ].includes(normalized);
};

export const getEdRegistrationPrefill = (
  context: AnyRecord | null | undefined,
): {
  chiefComplaint?: string;
  presentingSymptoms?: string;
  allergies?: string;
  currentMedications?: string;
} => {
  if (!context) return {};

  const latestEdVisit = context?.modules?.ed?.latestVisit;
  const latestCardiologyEncounter = context?.modules?.cardiology?.latestEncounter;
  const latestVitals = context?.latestVitals;

  const presentingSymptomsLines: string[] = [];
  if (latestEdVisit?.presenting_symptoms) {
    presentingSymptomsLines.push(String(latestEdVisit.presenting_symptoms));
  } else if (latestCardiologyEncounter?.visit_reason) {
    presentingSymptomsLines.push(`Cardiology recent reason: ${latestCardiologyEncounter.visit_reason}`);
  }
  if (latestVitals?.oxygenSaturation != null) {
    presentingSymptomsLines.push(`Latest SpO2: ${latestVitals.oxygenSaturation}%`);
  }

  return {
    chiefComplaint: latestEdVisit?.chief_complaint || latestCardiologyEncounter?.visit_reason || undefined,
    presentingSymptoms: presentingSymptomsLines.length ? presentingSymptomsLines.join('\n') : undefined,
    allergies: latestEdVisit?.allergies || undefined,
    currentMedications: latestEdVisit?.current_medications || undefined,
  };
};

export const getEdRegistrationDuplicateGuard = (
  context: AnyRecord | null | undefined,
  draft: {
    chiefComplaint?: string | null;
  },
): DuplicateGuardPrompt | null => {
  const latestVisit = context?.modules?.ed?.latestVisit;
  if (!latestVisit || !isEdVisitActive(latestVisit.ed_status)) {
    return null;
  }

  const recent = isWithinLastDays(latestVisit.arrival_date, 2);
  const sameComplaint =
    normalizeText(draft.chiefComplaint) &&
    normalizeText(draft.chiefComplaint) === normalizeText(latestVisit.chief_complaint);

  if (!recent || !sameComplaint) {
    return null;
  }

  return {
    title: 'Possible Duplicate ED Registration',
    message:
      `Patient already has an active ED visit (${latestVisit.ed_visit_number || latestVisit.id}) ` +
      `with the same complaint in the last 48 hours. Continue anyway?`,
    confirmText: 'Register New ED Visit',
    cancelText: 'Review Existing ED Visit',
  };
};

export const getTelemedicineConsultationPrefill = (
  context: AnyRecord | null | undefined,
): {
  consultationType?: string;
  scheduledDateTime: string;
  notes?: string;
} => {
  const latestConsultation = context?.modules?.telemedicine?.latestConsultation;
  const latestEdVisit = context?.modules?.ed?.latestVisit;
  const latestVitals = context?.latestVitals;

  const noteLines: string[] = [];
  if (latestConsultation?.technical_issues) {
    noteLines.push(`Previous technical issue: ${latestConsultation.technical_issues}`);
  }
  if (latestEdVisit?.chief_complaint) {
    noteLines.push(`Recent ED complaint: ${latestEdVisit.chief_complaint}`);
  }
  if (latestVitals?.bloodPressure) {
    noteLines.push(`Latest BP: ${latestVitals.bloodPressure}`);
  }

  return {
    consultationType: latestConsultation?.consultation_type || undefined,
    scheduledDateTime: toLocalDateTimeInputValue(),
    notes: noteLines.length ? noteLines.join('\n') : undefined,
  };
};

export const getLabOrderPrefill = (
  context: AnyRecord | null | undefined,
): {
  priority?: 'routine' | 'urgent' | 'stat';
  clinicalInfo?: string;
  specialInstructions?: string;
} => {
  if (!context) return {};

  const latestLabAlert = context?.modules?.lab?.latestCriticalAlert;
  const latestLabOrder = context?.modules?.lab?.latestOrder;
  const latestOncologyCase = context?.modules?.oncology?.latestCase;
  const latestSepsisScreening = context?.modules?.sepsis?.latestScreening;
  const latestTelemedicineConsultation = context?.modules?.telemedicine?.latestConsultation;

  const severity = normalizeText(latestLabAlert?.severity);
  const priority: 'routine' | 'urgent' | 'stat' =
    severity === 'panic' || severity === 'critical'
      ? 'stat'
      : normalizeText(latestLabOrder?.priority) === 'stat'
        ? 'stat'
      : latestSepsisScreening?.sepsis_suspected
        ? 'urgent'
        : 'routine';

  const clinicalInfoLines: string[] = [];
  if (latestLabAlert?.component_name && latestLabAlert?.result_value) {
    clinicalInfoLines.push(
      `Recent critical marker: ${latestLabAlert.component_name} = ${latestLabAlert.result_value}`,
    );
  }
  if (latestLabOrder?.clinical_info) {
    clinicalInfoLines.push(`Latest lab order context: ${latestLabOrder.clinical_info}`);
  }
  if (latestOncologyCase?.primary_diagnosis) {
    clinicalInfoLines.push(`Oncology diagnosis: ${latestOncologyCase.primary_diagnosis}`);
  }
  if (latestSepsisScreening?.sepsis_suspected) {
    clinicalInfoLines.push('Recent sepsis screening suspected infection risk.');
  }

  const specialInstructionLines: string[] = [];
  if (latestTelemedicineConsultation?.status) {
    specialInstructionLines.push(
      `Telemedicine context: ${String(latestTelemedicineConsultation.status).replace(/_/g, ' ')}`,
    );
  }
  if (latestLabAlert?.critical_range) {
    specialInstructionLines.push(`Critical range reference: ${latestLabAlert.critical_range}`);
  }
  if (latestLabOrder?.special_instructions) {
    specialInstructionLines.push(
      `Latest lab order instruction: ${latestLabOrder.special_instructions}`,
    );
  }

  return {
    priority,
    clinicalInfo: clinicalInfoLines.length ? clinicalInfoLines.join('\n') : undefined,
    specialInstructions: specialInstructionLines.length
      ? specialInstructionLines.join('\n')
      : undefined,
  };
};

export const getImagingOrderPrefill = (
  context: AnyRecord | null | undefined,
): {
  priority?: 'routine' | 'urgent' | 'stat';
  clinicalIndication?: string;
  clinicalHistory?: string;
  suspectedDiagnosis?: string;
} => {
  if (!context) return {};

  const latestImagingReport = context?.modules?.imaging?.latestReport;
  const latestLabAlert = context?.modules?.lab?.latestCriticalAlert;
  const latestEdVisit = context?.modules?.ed?.latestVisit;
  const latestCardiologyEncounter = context?.modules?.cardiology?.latestEncounter;
  const latestOncologyCase = context?.modules?.oncology?.latestCase;

  const criticalImaging =
    Boolean(latestImagingReport?.is_critical) ||
    normalizeText(latestImagingReport?.severity) === 'critical';
  const criticalLab =
    ['critical', 'panic'].includes(normalizeText(latestLabAlert?.severity));

  const priority: 'routine' | 'urgent' | 'stat' = criticalImaging
    ? 'stat'
    : criticalLab
      ? 'urgent'
      : 'routine';

  const indicationParts: string[] = [];
  if (latestEdVisit?.chief_complaint) {
    indicationParts.push(`ED complaint: ${latestEdVisit.chief_complaint}`);
  }
  if (latestCardiologyEncounter?.visit_reason) {
    indicationParts.push(`Cardiology reason: ${latestCardiologyEncounter.visit_reason}`);
  }
  if (latestImagingReport?.clinical_indication) {
    indicationParts.push(`Previous imaging indication: ${latestImagingReport.clinical_indication}`);
  }

  const historyLines: string[] = [];
  if (latestImagingReport?.clinical_history) {
    historyLines.push(`Prior imaging history: ${latestImagingReport.clinical_history}`);
  }
  if (latestImagingReport?.recommendations) {
    historyLines.push(`Previous recommendation: ${latestImagingReport.recommendations}`);
  }
  if (latestLabAlert?.component_name && latestLabAlert?.result_value) {
    historyLines.push(
      `Related lab alert: ${latestLabAlert.component_name} ${latestLabAlert.result_value}`,
    );
  }
  if (latestOncologyCase?.primary_diagnosis) {
    historyLines.push(`Oncology diagnosis: ${latestOncologyCase.primary_diagnosis}`);
  }

  const suspectedDiagnosis =
    latestImagingReport?.impression ||
    latestOncologyCase?.primary_diagnosis ||
    undefined;

  return {
    priority,
    clinicalIndication: indicationParts.length ? indicationParts.join(' | ') : undefined,
    clinicalHistory: historyLines.length ? historyLines.join('\n') : undefined,
    suspectedDiagnosis,
  };
};

export const getImagingOrderDuplicateGuard = (
  context: AnyRecord | null | undefined,
  draft: {
    studyName?: string | null;
    clinicalIndication?: string | null;
    suspectedDiagnosis?: string | null;
  },
): DuplicateGuardPrompt | null => {
  const latestReport = context?.modules?.imaging?.latestReport;
  if (!latestReport) return null;

  const recent = isWithinLastDays(
    latestReport?.report_datetime || latestReport?.signed_at || latestReport?.created_at,
    7,
  );
  if (!recent) return null;

  const sameStudy =
    normalizeText(draft.studyName) &&
    normalizeText(draft.studyName) === normalizeText(latestReport?.study_name);

  const sameIntent =
    normalizeText(draft.suspectedDiagnosis) &&
    normalizeText(draft.suspectedDiagnosis) === normalizeText(latestReport?.impression);

  const sameIndication =
    normalizeText(draft.clinicalIndication) &&
    normalizeText(draft.clinicalIndication) === normalizeText(latestReport?.clinical_indication);

  if (!sameStudy || (!sameIntent && !sameIndication)) {
    return null;
  }

  return {
    title: 'Possible Duplicate Imaging Order',
    message:
      `Recent ${latestReport.study_name || 'imaging'} report (${latestReport.id || 'existing'}) ` +
      'matches the same study and indication in the last 7 days. Continue anyway?',
    confirmText: 'Place New Imaging Order',
    cancelText: 'Review Latest Imaging Report',
  };
};

export const getPharmacyPrescriptionPrefill = (
  context: AnyRecord | null | undefined,
): {
  instructions?: string;
  indication?: string;
  pharmacyNotes?: string;
} => {
  if (!context) return {};

  const latestPrescription = context?.modules?.pharmacy?.latestPrescription;
  const latestHivEnrollment = context?.modules?.hiv?.latestEnrollment;
  const latestTelemedicineConsultation = context?.modules?.telemedicine?.latestConsultation;
  const latestLabAlert = context?.modules?.lab?.latestCriticalAlert;

  const instructionLines: string[] = [];
  if (latestPrescription?.dosage || latestPrescription?.frequency) {
    instructionLines.push(
      `Previous regimen context: ${latestPrescription.dosage || 'dose'} / ${latestPrescription.frequency || 'frequency'}`,
    );
  }
  if (latestHivEnrollment?.enrollment_status === 'active') {
    instructionLines.push('Coordinate adherence counseling with active HIV care plan.');
  }

  const noteLines: string[] = [];
  if (latestTelemedicineConsultation?.status) {
    noteLines.push(
      `Last telemedicine status: ${String(latestTelemedicineConsultation.status).replace(/_/g, ' ')}`,
    );
  }
  if (latestLabAlert?.component_name) {
    noteLines.push(`Check medication safety against recent ${latestLabAlert.component_name} result.`);
  }

  return {
    instructions: instructionLines.length ? instructionLines.join('\n') : undefined,
    indication: latestPrescription?.medication_name || undefined,
    pharmacyNotes: noteLines.length ? noteLines.join('\n') : undefined,
  };
};
