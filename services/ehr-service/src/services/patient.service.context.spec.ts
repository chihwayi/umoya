import { PatientService } from './patient.service';

describe('PatientService.getPatientContext', () => {
  const buildTenantDb = (
    queryImpl: (sql: string, params: any[]) => Promise<any>,
    patientOverride?: any,
  ) => {
    const patientRepository = {
      findOne: jest.fn().mockResolvedValue(
        patientOverride ?? {
          id: 'patient-1',
          patientNumber: 'P-001',
          firstName: 'Jane',
          lastName: 'Doe',
          dateOfBirth: '1992-01-10',
          gender: 'female',
          nationalId: '63-123456-Z-63',
          phone: '+263777000111',
          email: 'jane@example.org',
          address: '12 Example Street',
          city: 'Harare',
          bloodType: 'O+',
          emergencyContactName: 'John Doe',
          emergencyContactPhone: '+263777999888',
          medicalAidProvider: 'Example Aid',
          medicalAidNumber: 'AID-001',
          isActive: true,
        },
      ),
    };

    return {
      getRepository: jest.fn().mockReturnValue(patientRepository),
      query: jest.fn(queryImpl),
      __repo: patientRepository,
    } as any;
  };

  it('aggregates latest reusable context across HIV, maternity, oncology, specialty modules, and vitals', async () => {
    const service = new PatientService();
    const tenantDb = buildTenantDb(async (sql: string) => {
      if (sql.includes('FROM vitals')) {
        return [
          {
            id: 'vitals-1',
            blood_pressure: '120/78',
            heart_rate: 72,
            temperature: 36.8,
            respiratory_rate: 16,
            weight: 64.5,
            height: 165,
            bmi: 23.7,
            recorded_at: '2026-03-03T08:00:00.000Z',
          },
        ];
      }
      if (sql.includes('FROM hiv_care_enrollments')) {
        return [
          {
            id: 'hiv-enroll-1',
            enrollment_number: 'HIV-1001',
            enrollment_status: 'active',
          },
        ];
      }
      if (sql.includes('FROM maternity_enrollments')) {
        return [
          {
            id: 'mat-enroll-1',
            enrollment_number: 'MAT-2026-01',
            enrollment_status: 'active',
            gravida: 2,
            para: 1,
            parity_term: 1,
            parity_preterm: 0,
            parity_abortions: 0,
            parity_living: 1,
            previous_cesarean: false,
            previous_complications: 'None',
          },
        ];
      }
      if (sql.includes('FROM oncology_cases') && sql.includes('COUNT(*)')) {
        return [{ active_count: 1 }];
      }
      if (sql.includes('FROM oncology_cases')) {
        return [
          {
            id: 'onc-case-1',
            status: 'active',
            primary_diagnosis: 'Retinoblastoma',
          },
        ];
      }
      if (sql.includes('FROM cardiology_encounters')) {
        return [
          {
            id: 'card-enc-1',
            encounter_date: '2026-03-02T09:00:00.000Z',
            visit_reason: 'Chest pain',
            risk_score: 'high',
            care_status: 'in_progress',
          },
        ];
      }
      if (sql.includes('FROM ophthalmology_encounters')) {
        return [
          {
            id: 'oph-enc-1',
            encounter_date: '2026-03-01T10:00:00.000Z',
            chief_complaint: 'Blurred vision',
            payment_status: 'awaiting_payment',
          },
        ];
      }
      if (sql.includes('FROM ed_visits')) {
        return [
          {
            id: 'ed-visit-1',
            ed_visit_number: 'ED-2026-000001',
            arrival_date: '2026-02-28T20:00:00.000Z',
            presenting_symptoms: 'Chest pain and dizziness',
            allergies: 'Penicillin',
            current_medications: 'Aspirin',
            ed_status: 'discharged',
            triage_level: 3,
          },
        ];
      }
      if (sql.includes('FROM sepsis_screenings')) {
        return [
          {
            id: 'sepsis-screen-1',
            screening_location: 'ED',
            screening_datetime: '2026-02-28T20:30:00.000Z',
            sepsis_suspected: true,
            qsofa_score: 2,
          },
        ];
      }
      if (sql.includes('FROM sepsis_bundles')) {
        return [
          {
            id: 'sepsis-bundle-1',
            bundle_start_time: '2026-02-28T20:45:00.000Z',
            overall_compliance: false,
          },
        ];
      }
      if (sql.includes('FROM blood_transfusions bt') && sql.includes('LIMIT 1')) {
        return [
          {
            id: 'tx-1',
            transfusion_status: 'in_progress',
            order_date: '2026-03-03T08:00:00.000Z',
            unit_number: 'UNIT-001',
          },
        ];
      }
      if (sql.includes('FROM blood_transfusions') && sql.includes('COUNT(*)')) {
        return [{ active_count: 1 }];
      }
      if (sql.includes('FROM telemedicine_consultations')) {
        return [
          {
            id: 'tele-consult-1',
            consultation_type: 'follow_up',
            status: 'scheduled',
            scheduled_start_time: '2026-03-05T10:00:00.000Z',
            patient_consent: false,
          },
        ];
      }
      if (sql.includes('FROM lab_critical_alerts lca') && sql.includes('LIMIT 1')) {
        return [
          {
            id: 'lab-alert-1',
            lab_order_id: 'lab-order-1',
            component_name: 'Potassium',
            result_value: '6.8',
            critical_range: '>= 6.5',
            severity: 'critical',
            alert_status: 'pending',
          },
        ];
      }
      if (sql.includes('FROM lab_critical_alerts') && sql.includes('COUNT(*)')) {
        return [{ active_count: 1 }];
      }
      if (sql.includes('FROM lab_orders') && sql.includes('LIMIT 1')) {
        return [
          {
            id: 'lab-order-1',
            order_number: 'LAB-2026-001',
            status: 'pending',
            priority: 'urgent',
            test_name: 'Potassium',
            clinical_info: 'Repeat due to hyperkalemia',
            special_instructions: 'Collect stat sample',
          },
        ];
      }
      if (sql.includes('FROM lab_orders') && sql.includes('COUNT(*)')) {
        return [{ active_count: 2 }];
      }
      if (sql.includes('FROM imaging_reports r') && sql.includes('LIMIT 1')) {
        return [
          {
            id: 'img-report-1',
            imaging_order_id: 'img-order-1',
            report_status: 'final',
            is_critical: true,
            severity: 'high',
            follow_up_recommended: true,
            follow_up_interval: '24h',
            impression: 'Possible lower lobe consolidation',
            recommendations: 'Repeat CXR in 24 hours',
            clinical_indication: 'Persistent cough',
            study_name: 'Chest X-Ray',
            modality_name: 'X-Ray',
          },
        ];
      }
      if (sql.includes('FROM imaging_reports r') && sql.includes('COUNT(*)')) {
        return [{ active_count: 1 }];
      }
      if (sql.includes('FROM prescriptions p') && sql.includes('LIMIT 1')) {
        return [
          {
            id: 'rx-1',
            prescription_number: 'RX00000123',
            medication_name: 'Atorvastatin',
            dosage: '20 mg',
            frequency: 'once daily',
            status: 'active',
          },
        ];
      }
      if (sql.includes('FROM prescriptions') && sql.includes('COUNT(*)')) {
        return [{ active_count: 1 }];
      }
      if (sql.includes('FROM hiv_clinical_visits')) {
        return [
          {
            id: 'hiv-visit-1',
            visit_date: '2026-03-01',
            arv_status: '2',
            arv_regimen_name: 'TLD',
            next_review_date: '2026-04-01',
          },
        ];
      }
      if (sql.includes('FROM anc_visits')) {
        return [{ id: 'anc-1', visit_date: '2026-02-20' }];
      }
      if (sql.includes('FROM postnatal_visits')) {
        return [];
      }
      if (sql.includes('FROM deliveries')) {
        return [{ id: 'delivery-1', delivery_date: '2025-11-30' }];
      }
      return [];
    });

    const result = await service.getPatientContext('patient-1', tenantDb);

    expect(result.patient.id).toBe('patient-1');
    expect(result.patient.fullName).toBe('Jane Doe');
    expect(result.latestVitals.id).toBe('vitals-1');
    expect(result.modules.hiv.latestEnrollment.id).toBe('hiv-enroll-1');
    expect(result.modules.hiv.latestClinicalVisit.id).toBe('hiv-visit-1');
    expect(result.modules.maternity.latestEnrollment.id).toBe('mat-enroll-1');
    expect(result.modules.oncology.latestCase.id).toBe('onc-case-1');
    expect(result.modules.oncology.activeCaseCount).toBe(1);
    expect(result.modules.cardiology.latestEncounter.id).toBe('card-enc-1');
    expect(result.modules.ophthalmology.latestEncounter.id).toBe('oph-enc-1');
    expect(result.modules.ed.latestVisit.id).toBe('ed-visit-1');
    expect(result.modules.sepsis.latestScreening.id).toBe('sepsis-screen-1');
    expect(result.modules.sepsis.latestBundle.id).toBe('sepsis-bundle-1');
    expect(result.modules.bloodBank.latestTransfusion.id).toBe('tx-1');
    expect(result.modules.bloodBank.activeTransfusionCount).toBe(1);
    expect(result.modules.telemedicine.latestConsultation.id).toBe('tele-consult-1');
    expect(result.modules.lab.latestCriticalAlert.id).toBe('lab-alert-1');
    expect(result.modules.lab.unresolvedAlertCount).toBe(1);
    expect(result.modules.lab.latestOrder.id).toBe('lab-order-1');
    expect(result.modules.lab.activeOrderCount).toBe(2);
    expect(result.modules.imaging.latestReport.id).toBe('img-report-1');
    expect(result.modules.imaging.actionableUnacknowledgedCount).toBe(1);
    expect(result.modules.pharmacy.latestPrescription.id).toBe('rx-1');
    expect(result.modules.pharmacy.activePrescriptionCount).toBe(1);
  });

  it('returns base patient context even when module tables are missing', async () => {
    const service = new PatientService();
    const tenantDb = buildTenantDb(async () => {
      const err: any = new Error('relation does not exist');
      err.code = '42P01';
      throw err;
    });

    const result = await service.getPatientContext('patient-1', tenantDb);

    expect(result.patient.id).toBe('patient-1');
    expect(result.latestVitals).toBeNull();
    expect(result.modules.hiv.latestEnrollment).toBeNull();
    expect(result.modules.hiv.latestClinicalVisit).toBeNull();
    expect(result.modules.maternity.latestEnrollment).toBeNull();
    expect(result.modules.oncology.latestCase).toBeNull();
    expect(result.modules.oncology.activeCaseCount).toBe(0);
    expect(result.modules.cardiology.latestEncounter).toBeNull();
    expect(result.modules.ophthalmology.latestEncounter).toBeNull();
    expect(result.modules.ed.latestVisit).toBeNull();
    expect(result.modules.sepsis.latestScreening).toBeNull();
    expect(result.modules.sepsis.latestBundle).toBeNull();
    expect(result.modules.bloodBank.latestTransfusion).toBeNull();
    expect(result.modules.bloodBank.activeTransfusionCount).toBe(0);
    expect(result.modules.telemedicine.latestConsultation).toBeNull();
    expect(result.modules.lab.latestCriticalAlert).toBeNull();
    expect(result.modules.lab.unresolvedAlertCount).toBe(0);
    expect(result.modules.lab.latestOrder).toBeNull();
    expect(result.modules.lab.activeOrderCount).toBe(0);
    expect(result.modules.imaging.latestReport).toBeNull();
    expect(result.modules.imaging.actionableUnacknowledgedCount).toBe(0);
    expect(result.modules.pharmacy.latestPrescription).toBeNull();
    expect(result.modules.pharmacy.activePrescriptionCount).toBe(0);
  });
});
