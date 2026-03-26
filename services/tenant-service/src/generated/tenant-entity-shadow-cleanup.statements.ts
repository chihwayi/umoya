// Generated manually to reconcile historical camelCase shadow columns that were created by stale entity metadata.
// The bundle backfills canonical snake_case columns where possible and then drops the shadow columns.

export const TENANT_ENTITY_SHADOW_CLEANUP_BUNDLE_VERSION = '2026.03.23.2';

export const TENANT_ENTITY_SHADOW_CLEANUP_STATEMENTS = [
  `DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'analytics_metrics'
      AND column_name = 'metricName'
  ) THEN
    UPDATE analytics_metrics
    SET metric_name = COALESCE(metric_name, "metricName"),
        metric_category = COALESCE(metric_category, "metricCategory"),
        metric_date = COALESCE(metric_date, "metricDate"),
        metric_value = COALESCE(metric_value, "metricValue"),
        metric_unit = COALESCE(metric_unit, "metricUnit"),
        calculated_at = COALESCE(calculated_at, "calculatedAt"),
        calculation_method = COALESCE(calculation_method, "calculationMethod")
    WHERE "metricName" IS NOT NULL
       OR "metricCategory" IS NOT NULL
       OR "metricDate" IS NOT NULL
       OR "metricValue" IS NOT NULL
       OR "metricUnit" IS NOT NULL
       OR "calculatedAt" IS NOT NULL
       OR "calculationMethod" IS NOT NULL;
  END IF;
END
$$;`,
  `ALTER TABLE analytics_metrics
    DROP COLUMN IF EXISTS "calculatedAt",
    DROP COLUMN IF EXISTS "calculationMethod",
    DROP COLUMN IF EXISTS "metricCategory",
    DROP COLUMN IF EXISTS "metricDate",
    DROP COLUMN IF EXISTS "metricName",
    DROP COLUMN IF EXISTS "metricUnit",
    DROP COLUMN IF EXISTS "metricValue"`,
  `DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'anesthesia_records'
      AND column_name = 'crnaId'
  ) THEN
    UPDATE anesthesia_records
    SET crna_id = COALESCE(
      crna_id,
      CASE
        WHEN NULLIF("crnaId", '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          THEN NULLIF("crnaId", '')::uuid
        ELSE NULL
      END
    )
    WHERE "crnaId" IS NOT NULL;
  END IF;
END
$$;`,
  `ALTER TABLE anesthesia_records DROP COLUMN IF EXISTS "crnaId"`,
  `DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'clinical_outcomes'
      AND column_name = 'outcomeType'
  ) THEN
    UPDATE clinical_outcomes
    SET baseline_date = COALESCE(baseline_date, "baselineDate"),
        outcome_date = COALESCE(outcome_date, "outcomeDate"),
        outcome_status = COALESCE(outcome_status, "outcomeStatus"),
        outcome_type = COALESCE(outcome_type, "outcomeType"),
        outcome_unit = COALESCE(outcome_unit, "outcomeUnit"),
        outcome_value = COALESCE(outcome_value, "outcomeValue"),
        snomed_code = COALESCE(snomed_code, "snomedCode")
    WHERE "baselineDate" IS NOT NULL
       OR "outcomeDate" IS NOT NULL
       OR "outcomeStatus" IS NOT NULL
       OR "outcomeType" IS NOT NULL
       OR "outcomeUnit" IS NOT NULL
       OR "outcomeValue" IS NOT NULL
       OR "snomedCode" IS NOT NULL;
  END IF;
END
$$;`,
  `ALTER TABLE clinical_outcomes
    DROP COLUMN IF EXISTS "baselineDate",
    DROP COLUMN IF EXISTS "outcomeDate",
    DROP COLUMN IF EXISTS "outcomeStatus",
    DROP COLUMN IF EXISTS "outcomeType",
    DROP COLUMN IF EXISTS "outcomeUnit",
    DROP COLUMN IF EXISTS "outcomeValue",
    DROP COLUMN IF EXISTS "snomedCode"`,
  `DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'medical_records'
      AND column_name = 'patientId'
  ) THEN
    UPDATE medical_records
    SET record_number = COALESCE(record_number, "recordNumber"),
        appointment_id = COALESCE(
          appointment_id,
          CASE
            WHEN NULLIF("appointmentId", '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
              THEN NULLIF("appointmentId", '')::uuid
            ELSE NULL
          END
        ),
        doctor_id = COALESCE(
          doctor_id,
          CASE
            WHEN NULLIF("providerId", '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
              THEN NULLIF("providerId", '')::uuid
            ELSE NULL
          END,
          created_by
        ),
        visit_date = COALESCE(visit_date, "recordDate", created_at),
        chief_complaint = COALESCE(chief_complaint, "chiefComplaint", title),
        history_present_illness = COALESCE(history_present_illness, "historyOfPresentIllness", content),
        physical_examination = COALESCE(physical_examination, "physicalExamination"),
        follow_up_instructions = COALESCE(follow_up_instructions, "followUpInstructions"),
        vital_signs = COALESCE(vital_signs, "vitalSigns"),
        is_confidential = COALESCE(
          is_confidential,
          CASE
            WHEN "isConfidential" IS NULL THEN NULL
            WHEN LOWER(TRIM("isConfidential"::text)) IN ('true', 't', '1', 'yes') THEN TRUE
            WHEN LOWER(TRIM("isConfidential"::text)) IN ('false', 'f', '0', 'no') THEN FALSE
            ELSE NULL
          END,
          FALSE
        )
    WHERE "recordNumber" IS NOT NULL
       OR "appointmentId" IS NOT NULL
       OR "providerId" IS NOT NULL
       OR "recordDate" IS NOT NULL
       OR "chiefComplaint" IS NOT NULL
       OR "historyOfPresentIllness" IS NOT NULL
       OR "physicalExamination" IS NOT NULL
       OR "followUpInstructions" IS NOT NULL
       OR "vitalSigns" IS NOT NULL
       OR "isConfidential" IS NOT NULL;
  END IF;
END
$$;`,
  `UPDATE medical_records
    SET doctor_id = COALESCE(doctor_id, created_by),
        record_type = COALESCE(record_type, type),
        visit_date = COALESCE(visit_date, created_at),
        chief_complaint = COALESCE(chief_complaint, title),
        history_present_illness = COALESCE(history_present_illness, content),
        is_confidential = COALESCE(is_confidential, FALSE)`,
  `ALTER TABLE medical_records
    DROP COLUMN IF EXISTS "appointmentId",
    DROP COLUMN IF EXISTS "chiefComplaint",
    DROP COLUMN IF EXISTS "createdAt",
    DROP COLUMN IF EXISTS "followUpInstructions",
    DROP COLUMN IF EXISTS "historyOfPresentIllness",
    DROP COLUMN IF EXISTS "isConfidential",
    DROP COLUMN IF EXISTS "patientId",
    DROP COLUMN IF EXISTS "physicalExamination",
    DROP COLUMN IF EXISTS "providerId",
    DROP COLUMN IF EXISTS "recordDate",
    DROP COLUMN IF EXISTS "recordNumber",
    DROP COLUMN IF EXISTS "updatedAt",
    DROP COLUMN IF EXISTS "vitalSigns"`,
  `ALTER TABLE medical_records DROP COLUMN IF EXISTS type`,
  `DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'medication_adherence'
      AND column_name = 'medicationId'
  ) THEN
    UPDATE medication_adherence
    SET medication_id = COALESCE(medication_id, "medicationId"),
        patient_id = COALESCE(patient_id, "patientId"),
        adherence_date = COALESCE(adherence_date, "adherenceDate"),
        missed_reason = COALESCE(missed_reason, "missedReason"),
        recorded_by = COALESCE(recorded_by, "recordedById"),
        created_at = COALESCE(created_at, "createdAt"),
        updated_at = COALESCE(updated_at, "updatedAt")
    WHERE "medicationId" IS NOT NULL
       OR "patientId" IS NOT NULL
       OR "adherenceDate" IS NOT NULL
       OR "missedReason" IS NOT NULL
       OR "recordedById" IS NOT NULL
       OR "createdAt" IS NOT NULL
       OR "updatedAt" IS NOT NULL;
  END IF;
END
$$;`,
  `ALTER TABLE medication_adherence
    DROP COLUMN IF EXISTS "adherenceDate",
    DROP COLUMN IF EXISTS "createdAt",
    DROP COLUMN IF EXISTS "medicationId",
    DROP COLUMN IF EXISTS "missedReason",
    DROP COLUMN IF EXISTS "patientId",
    DROP COLUMN IF EXISTS "recordedById",
    DROP COLUMN IF EXISTS "updatedAt"`,
  `DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'medication_reconciliation_log'
      AND column_name = 'patientId'
  ) THEN
    UPDATE medication_reconciliation_log
    SET patient_id = COALESCE(patient_id, "patientId"),
        reconciliation_date = COALESCE(reconciliation_date, "reconciliationDate"),
        reconciled_by = COALESCE(reconciled_by, "reconciledById"),
        reconciliation_type = COALESCE(reconciliation_type, "reconciliationType"),
        discrepancies_found = COALESCE(discrepancies_found, "discrepanciesFound"),
        discrepancies_resolved = COALESCE(discrepancies_resolved, "discrepanciesResolved"),
        created_at = COALESCE(created_at, "createdAt"),
        updated_at = COALESCE(updated_at, "updatedAt")
    WHERE "patientId" IS NOT NULL
       OR "reconciliationDate" IS NOT NULL
       OR "reconciledById" IS NOT NULL
       OR "reconciliationType" IS NOT NULL
       OR "discrepanciesFound" IS NOT NULL
       OR "discrepanciesResolved" IS NOT NULL
       OR "createdAt" IS NOT NULL
       OR "updatedAt" IS NOT NULL;
  END IF;
END
$$;`,
  `ALTER TABLE medication_reconciliation_log
    DROP COLUMN IF EXISTS "createdAt",
    DROP COLUMN IF EXISTS "discrepanciesFound",
    DROP COLUMN IF EXISTS "discrepanciesResolved",
    DROP COLUMN IF EXISTS "patientId",
    DROP COLUMN IF EXISTS "reconciledById",
    DROP COLUMN IF EXISTS "reconciliationDate",
    DROP COLUMN IF EXISTS "reconciliationType",
    DROP COLUMN IF EXISTS "updatedAt"`,
  `DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'patient_medications'
      AND column_name = 'patientId'
  ) THEN
    UPDATE patient_medications
    SET patient_id = COALESCE(patient_id, "patientId"),
        medication_name = COALESCE(medication_name, "medicationName"),
        generic_name = COALESCE(generic_name, "genericName"),
        snomed_concept_id = COALESCE(snomed_concept_id, "snomedConceptId"),
        snomed_term = COALESCE(snomed_term, "snomedTerm"),
        medication_type = COALESCE(medication_type, "medicationType"),
        dosage_unit = COALESCE(dosage_unit, "dosageUnit"),
        start_date = COALESCE(start_date, "startDate"),
        end_date = COALESCE(end_date, "endDate"),
        prescribed_by = COALESCE(prescribed_by, "prescribedBy"),
        prescribing_physician_name = COALESCE(prescribing_physician_name, "prescribingPhysicianName"),
        prescription_id = COALESCE(prescription_id, "prescriptionId"),
        reason_for_discontinuation = COALESCE(reason_for_discontinuation, "reasonForDiscontinuation"),
        adherence_percentage = COALESCE(adherence_percentage, "adherencePercentage"),
        last_taken_date = COALESCE(last_taken_date, "lastTakenDate"),
        reconciliation_status = COALESCE(reconciliation_status, "reconciliationStatus"),
        reconciliation_notes = COALESCE(reconciliation_notes, "reconciliationNotes"),
        created_by = COALESCE(created_by, "createdById"),
        created_at = COALESCE(created_at, "createdAt"),
        updated_at = COALESCE(updated_at, "updatedAt")
    WHERE "patientId" IS NOT NULL
       OR "medicationName" IS NOT NULL
       OR "genericName" IS NOT NULL
       OR "snomedConceptId" IS NOT NULL
       OR "snomedTerm" IS NOT NULL
       OR "medicationType" IS NOT NULL
       OR "dosageUnit" IS NOT NULL
       OR "startDate" IS NOT NULL
       OR "endDate" IS NOT NULL
       OR "prescribedBy" IS NOT NULL
       OR "prescribingPhysicianName" IS NOT NULL
       OR "prescriptionId" IS NOT NULL
       OR "reasonForDiscontinuation" IS NOT NULL
       OR "adherencePercentage" IS NOT NULL
       OR "lastTakenDate" IS NOT NULL
       OR "reconciliationStatus" IS NOT NULL
       OR "reconciliationNotes" IS NOT NULL
       OR "createdById" IS NOT NULL
       OR "createdAt" IS NOT NULL
       OR "updatedAt" IS NOT NULL;
  END IF;
END
$$;`,
  `ALTER TABLE patient_medications
    DROP COLUMN IF EXISTS "adherencePercentage",
    DROP COLUMN IF EXISTS "createdAt",
    DROP COLUMN IF EXISTS "createdById",
    DROP COLUMN IF EXISTS "dosageUnit",
    DROP COLUMN IF EXISTS "endDate",
    DROP COLUMN IF EXISTS "genericName",
    DROP COLUMN IF EXISTS "lastTakenDate",
    DROP COLUMN IF EXISTS "medicationName",
    DROP COLUMN IF EXISTS "medicationType",
    DROP COLUMN IF EXISTS "patientId",
    DROP COLUMN IF EXISTS "prescribedBy",
    DROP COLUMN IF EXISTS "prescribingPhysicianName",
    DROP COLUMN IF EXISTS "prescriptionId",
    DROP COLUMN IF EXISTS "reasonForDiscontinuation",
    DROP COLUMN IF EXISTS "reconciliationNotes",
    DROP COLUMN IF EXISTS "reconciliationStatus",
    DROP COLUMN IF EXISTS "snomedConceptId",
    DROP COLUMN IF EXISTS "snomedTerm",
    DROP COLUMN IF EXISTS "startDate",
    DROP COLUMN IF EXISTS "updatedAt"`,
  `DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'report_executions'
      AND column_name = 'executionType'
  ) THEN
    UPDATE report_executions
    SET execution_type = COALESCE(execution_type, "executionType"),
        execution_time = COALESCE(execution_time, "executionTime"),
        duration_ms = COALESCE(duration_ms, "durationMs"),
        filters_applied = COALESCE(filters_applied, "filtersApplied"),
        result_count = COALESCE(result_count, "resultCount"),
        file_url = COALESCE(file_url, "fileUrl"),
        error_message = COALESCE(error_message, "errorMessage")
    WHERE "executionType" IS NOT NULL
       OR "executionTime" IS NOT NULL
       OR "durationMs" IS NOT NULL
       OR "filtersApplied" IS NOT NULL
       OR "resultCount" IS NOT NULL
       OR "fileUrl" IS NOT NULL
       OR "errorMessage" IS NOT NULL;
  END IF;
END
$$;`,
  `ALTER TABLE report_executions
    DROP COLUMN IF EXISTS "durationMs",
    DROP COLUMN IF EXISTS "errorMessage",
    DROP COLUMN IF EXISTS "executionTime",
    DROP COLUMN IF EXISTS "executionType",
    DROP COLUMN IF EXISTS "fileUrl",
    DROP COLUMN IF EXISTS "filtersApplied",
    DROP COLUMN IF EXISTS "resultCount"`,
  `DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'report_favorites'
      AND column_name = 'customName'
  ) THEN
    UPDATE report_favorites
    SET custom_name = COALESCE(custom_name, "customName")
    WHERE "customName" IS NOT NULL;
  END IF;
END
$$;`,
  `ALTER TABLE report_favorites DROP COLUMN IF EXISTS "customName"`,
  `DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'report_templates'
      AND column_name = 'reportType'
  ) THEN
    UPDATE report_templates
    SET report_type = COALESCE(report_type, "reportType"),
        query_config = COALESCE(query_config, "queryConfig"),
        visualization_config = COALESCE(visualization_config, "visualizationConfig"),
        is_public = COALESCE(is_public, "isPublic"),
        is_default = COALESCE(is_default, "isDefault"),
        shared_with_roles = COALESCE(shared_with_roles, "sharedWithRoles"),
        usage_count = COALESCE(usage_count, "usageCount"),
        last_used = COALESCE(last_used, "lastUsed")
    WHERE "reportType" IS NOT NULL
       OR "queryConfig" IS NOT NULL
       OR "visualizationConfig" IS NOT NULL
       OR "isPublic" IS NOT NULL
       OR "isDefault" IS NOT NULL
       OR "sharedWithRoles" IS NOT NULL
       OR "usageCount" IS NOT NULL
       OR "lastUsed" IS NOT NULL;
  END IF;
END
$$;`,
  `ALTER TABLE report_templates
    DROP COLUMN IF EXISTS "isDefault",
    DROP COLUMN IF EXISTS "isPublic",
    DROP COLUMN IF EXISTS "lastUsed",
    DROP COLUMN IF EXISTS "queryConfig",
    DROP COLUMN IF EXISTS "reportType",
    DROP COLUMN IF EXISTS "sharedWithRoles",
    DROP COLUMN IF EXISTS "usageCount",
    DROP COLUMN IF EXISTS "visualizationConfig"`,
  `DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'scheduled_reports'
      AND column_name = 'scheduleType'
  ) THEN
    UPDATE scheduled_reports
    SET schedule_type = COALESCE(schedule_type, "scheduleType"),
        schedule_config = COALESCE(schedule_config, "scheduleConfig"),
        recipient_roles = COALESCE(recipient_roles, "recipientRoles"),
        is_active = COALESCE(is_active, "isActive"),
        last_run = COALESCE(last_run, "lastRun"),
        next_run = COALESCE(next_run, "nextRun"),
        run_count = COALESCE(run_count, "runCount"),
        error_count = COALESCE(error_count, "errorCount"),
        last_error = COALESCE(last_error, "lastError")
    WHERE "scheduleType" IS NOT NULL
       OR "scheduleConfig" IS NOT NULL
       OR "recipientRoles" IS NOT NULL
       OR "isActive" IS NOT NULL
       OR "lastRun" IS NOT NULL
       OR "nextRun" IS NOT NULL
       OR "runCount" IS NOT NULL
       OR "errorCount" IS NOT NULL
       OR "lastError" IS NOT NULL;
  END IF;
END
$$;`,
  `ALTER TABLE scheduled_reports
    DROP COLUMN IF EXISTS "errorCount",
    DROP COLUMN IF EXISTS "isActive",
    DROP COLUMN IF EXISTS "lastError",
    DROP COLUMN IF EXISTS "lastRun",
    DROP COLUMN IF EXISTS "nextRun",
    DROP COLUMN IF EXISTS "recipientRoles",
    DROP COLUMN IF EXISTS "runCount",
    DROP COLUMN IF EXISTS "scheduleConfig",
    DROP COLUMN IF EXISTS "scheduleType"`,
];
