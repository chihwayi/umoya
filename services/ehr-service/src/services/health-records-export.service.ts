import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TenantService } from './tenant.service';
import { FhirService } from './fhir.service';
import PDFDocument = require('pdfkit');
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class HealthRecordsExportService {
  private readonly logger = new Logger(HealthRecordsExportService.name);

  constructor(
    private tenantService: TenantService,
    private fhirService: FhirService,
  ) {}

  /**
   * Export complete patient medical records as PDF
   */
  async exportCompleteMedicalRecordPdf(
    patientId: string,
    tenantId: string,
    options: { startDate?: string; endDate?: string },
    requestedBy: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ filePath: string; fileSize: number; recordCount: number }> {
    const connection = await this.tenantService.getTenantDatabase(tenantId);
    if (!connection) {
      throw new Error(`Failed to connect to tenant database: ${tenantId}`);
    }

    // Get patient data
    const [patient] = await connection.query(
      `SELECT * FROM patients WHERE id = $1`,
      [patientId],
    );

    if (!patient) {
      throw new Error('Patient not found');
    }

    // Get all patient data
    const [appointments, medicalRecords, prescriptions, labResults, vitals, bills] = await Promise.all([
      this.getAppointments(connection, patientId, options),
      this.getMedicalRecords(connection, patientId, options),
      this.getPrescriptions(connection, patientId, options),
      this.getLabResults(connection, patientId, options),
      this.getVitals(connection, patientId, options),
      this.getBills(connection, patientId, options),
    ]);

    const recordCount = appointments.length + medicalRecords.length + prescriptions.length + labResults.length + vitals.length + bills.length;

    // Generate PDF
    const doc = new PDFDocument({ margin: 50 });
    const fileName = `medical-record-${patientId}-${Date.now()}.pdf`;
    const filePath = path.join('/tmp', fileName);
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // Header
    doc.fontSize(20).text('Complete Medical Record', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Patient: ${patient.first_name} ${patient.last_name}`, { align: 'center' });
    doc.text(`Patient Number: ${patient.patient_number}`, { align: 'center' });
    doc.text(`Date of Birth: ${patient.date_of_birth}`, { align: 'center' });
    doc.moveDown();

    // Appointments
    if (appointments.length > 0) {
      doc.addPage();
      doc.fontSize(16).text('Appointment History', { underline: true });
      doc.moveDown(0.5);
      appointments.forEach((apt: any, index: number) => {
        doc.fontSize(12).text(`${index + 1}. ${new Date(apt.appointment_date).toLocaleDateString()}`, { continued: true });
        doc.text(` - ${apt.appointment_type}`, { align: 'right' });
        doc.fontSize(10).text(`Status: ${apt.status}`, { indent: 20 });
        if (apt.reason) {
          doc.text(`Reason: ${apt.reason}`, { indent: 20 });
        }
        doc.moveDown(0.5);
      });
    }

    // Medical Records
    if (medicalRecords.length > 0) {
      doc.addPage();
      doc.fontSize(16).text('Medical Records', { underline: true });
      doc.moveDown(0.5);
      medicalRecords.forEach((record: any, index: number) => {
        doc.fontSize(12).text(`${index + 1}. ${new Date(record.visit_date).toLocaleDateString()}`, { continued: true });
        doc.text(` - ${record.record_type || 'Consultation'}`, { align: 'right' });
        if (record.chief_complaint) {
          doc.fontSize(10).text(`Chief Complaint: ${record.chief_complaint}`, { indent: 20 });
        }
        if (record.assessment) {
          doc.text(`Assessment: ${record.assessment}`, { indent: 20 });
        }
        doc.moveDown(0.5);
      });
    }

    // Prescriptions
    if (prescriptions.length > 0) {
      doc.addPage();
      doc.fontSize(16).text('Prescription History', { underline: true });
      doc.moveDown(0.5);
      prescriptions.forEach((rx: any, index: number) => {
        doc.fontSize(12).text(`${index + 1}. ${rx.medication_name}`, { indent: 20 });
        doc.fontSize(10).text(`Dosage: ${rx.dosage} | Frequency: ${rx.frequency}`, { indent: 20 });
        doc.text(`Prescribed: ${new Date(rx.prescribed_date || rx.prescribed_at || rx.created_at).toLocaleDateString()}`, { indent: 20 });
        doc.moveDown(0.5);
      });
    }

    // Lab Results
    if (labResults.length > 0) {
      doc.addPage();
      doc.fontSize(16).text('Laboratory Results', { underline: true });
      doc.moveDown(0.5);
      labResults.forEach((lab: any, index: number) => {
        doc.fontSize(12).text(`${index + 1}. ${lab.test_name}`, { indent: 20 });
        doc.fontSize(10).text(`Result: ${lab.result_value} ${lab.result_unit || ''}`, { indent: 20 });
        doc.text(`Date: ${new Date(lab.result_date || lab.test_date || lab.completed_at || lab.created_at).toLocaleDateString()}`, { indent: 20 });
        doc.moveDown(0.5);
      });
    }

    // Vitals
    if (vitals.length > 0) {
      doc.addPage();
      doc.fontSize(16).text('Vital Signs', { underline: true });
      doc.moveDown(0.5);
      vitals.forEach((vital: any, index: number) => {
        doc.fontSize(12).text(`${index + 1}. ${new Date(vital.recorded_at).toLocaleDateString()}`, { indent: 20 });
        doc.fontSize(10);
        if (vital.blood_pressure) doc.text(`BP: ${vital.blood_pressure}`, { indent: 20 });
        if (vital.heart_rate) doc.text(`Heart Rate: ${vital.heart_rate} bpm`, { indent: 20 });
        if (vital.temperature) doc.text(`Temperature: ${vital.temperature}°C`, { indent: 20 });
        doc.moveDown(0.5);
      });
    }

    // Footer
    doc.fontSize(8).text(`Generated on ${new Date().toLocaleString()}`, { align: 'center' });

    doc.end();

    // Wait for PDF to be written
    await new Promise((resolve, reject) => {
      stream.on('finish', resolve);
      stream.on('error', reject);
    });

    const stats = fs.statSync(filePath);
    const fileSize = stats.size;

    // Log export
    await this.logExport(connection, patientId, 'complete_pdf', 'pdf', options.startDate, options.endDate, filePath, recordCount, requestedBy, ipAddress, userAgent);

    return { filePath, fileSize, recordCount };
  }

  /**
   * Export patient data as FHIR Bundle
   */
  async exportFhirBundle(
    patientId: string,
    tenantId: string,
    options: { startDate?: string; endDate?: string },
    requestedBy: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ data: any; recordCount: number }> {
    const connection = await this.tenantService.getTenantDatabase(tenantId);
    if (!connection) {
      throw new Error(`Failed to connect to tenant database: ${tenantId}`);
    }

    // Get patient
    const patient = await connection.getRepository('Patient').findOne({ where: { id: patientId } });
    if (!patient) {
      throw new Error('Patient not found');
    }

    // Build FHIR Bundle
    const bundle: any = {
      resourceType: 'Bundle',
      type: 'document',
      id: `patient-export-${patientId}-${Date.now()}`,
      timestamp: new Date().toISOString(),
      entry: [],
    };

    // Get patient entity
    const patientRepo = connection.getRepository('Patient');
    const patientEntity = await patientRepo.findOne({ where: { id: patientId } });
    if (!patientEntity) {
      throw new Error('Patient not found');
    }

    // Ensure dateOfBirth is a Date object (might come as string from DB)
    if (patientEntity.dateOfBirth && typeof patientEntity.dateOfBirth === 'string') {
      patientEntity.dateOfBirth = new Date(patientEntity.dateOfBirth);
    }

    // Add Patient resource
    const fhirPatient = this.fhirService.patientToFhir(patientEntity);
    bundle.entry.push({
      resource: fhirPatient,
      fullUrl: `Patient/${patientId}`,
    });

    // Get and add other resources
    const [appointments, prescriptions, labResults, vitals] = await Promise.all([
      this.getAppointments(connection, patientId, options),
      this.getPrescriptions(connection, patientId, options),
      this.getLabResults(connection, patientId, options),
      this.getVitals(connection, patientId, options),
    ]);

    // Add Encounters (from appointments) - use raw data directly
    for (const aptData of appointments) {
      try {
        // Convert raw appointment data to entity-like object for FHIR conversion
        const aptEntity = {
          id: aptData.id,
          appointmentDate: aptData.appointment_date || aptData.appointmentDate,
          durationMinutes: aptData.duration_minutes || aptData.durationMinutes,
          appointmentType: aptData.appointment_type || aptData.appointmentType,
          status: aptData.status,
          reason: aptData.reason,
          notes: aptData.notes,
          patientId: aptData.patient_id || aptData.patientId,
          doctorId: aptData.doctor_id || aptData.doctorId,
        };
        const encounter = this.fhirService.appointmentToEncounter(aptEntity);
        bundle.entry.push({
          resource: encounter,
          fullUrl: `Encounter/${aptData.id}`,
        });
      } catch (error: any) {
        this.logger.warn(`[exportFhirBundle] Failed to convert appointment ${aptData.id} to FHIR: ${error.message}`);
      }
    }

    // Add MedicationRequests (from prescriptions) - use raw data directly
    for (const rxData of prescriptions) {
      try {
        // Convert raw prescription data to entity-like object for FHIR conversion
        const rxEntity = {
          id: rxData.id,
          medicationName: rxData.medication_name || rxData.medicationName,
          dosage: rxData.dosage,
          frequency: rxData.frequency,
          duration: rxData.duration,
          instructions: rxData.instructions,
          prescribedDate: rxData.prescribed_date || rxData.prescribedDate || rxData.created_at,
          patientId: rxData.patient_id || rxData.patientId,
          doctorId: rxData.doctor_id || rxData.doctorId,
        };
        const medicationRequest = this.fhirService.prescriptionToMedicationRequest(rxEntity);
        bundle.entry.push({
          resource: medicationRequest,
          fullUrl: `MedicationRequest/${rxData.id}`,
        });
      } catch (error: any) {
        this.logger.warn(`[exportFhirBundle] Failed to convert prescription ${rxData.id} to FHIR: ${error.message}`);
      }
    }

    // Add DiagnosticReports (from lab results) - use raw data directly
    for (const labData of labResults) {
      try {
        // Convert raw lab result data to entity-like object for FHIR conversion
        const labEntity = {
          id: labData.id,
          testName: labData.test_name || labData.testName,
          testCode: labData.test_code || labData.testCode,
          resultValue: labData.result_value || labData.resultValue,
          resultUnit: labData.unit || labData.resultUnit,
          referenceRange: labData.reference_range || labData.referenceRange,
          status: labData.status,
          resultDate: labData.result_date || labData.resultDate || labData.test_date || labData.testDate || labData.created_at,
          patientId: labData.patient_id || labData.patientId,
        };
        const diagnosticReport = this.fhirService.labOrderToDiagnosticReport(labEntity);
        bundle.entry.push({
          resource: diagnosticReport,
          fullUrl: `DiagnosticReport/${labData.id}`,
        });
      } catch (error: any) {
        this.logger.warn(`[exportFhirBundle] Failed to convert lab result ${labData.id} to FHIR: ${error.message}`);
      }
    }

    // Add Observations (from vitals)
    vitals.forEach((vital: any) => {
      const observation = this.vitalToObservation(vital, patientId);
      bundle.entry.push({
        resource: observation,
        fullUrl: `Observation/${vital.id}`,
      });
    });

    const recordCount = bundle.entry.length;

    // Log export
    await this.logExport(connection, patientId, 'fhir', 'fhir', options.startDate, options.endDate, null, recordCount, requestedBy, ipAddress, userAgent);

    return { data: bundle, recordCount };
  }

  /**
   * Export patient data as JSON
   */
  async exportJson(
    patientId: string,
    tenantId: string,
    options: { startDate?: string; endDate?: string },
    requestedBy: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ data: any; recordCount: number }> {
    const connection = await this.tenantService.getTenantDatabase(tenantId);
    if (!connection) {
      throw new Error(`Failed to connect to tenant database: ${tenantId}`);
    }

    // Get all patient data
    const [patient, appointments, medicalRecords, prescriptions, labResults, vitals, bills] = await Promise.all([
      connection.query(`SELECT * FROM patients WHERE id = $1`, [patientId]).then((r) => r[0]),
      this.getAppointments(connection, patientId, options),
      this.getMedicalRecords(connection, patientId, options),
      this.getPrescriptions(connection, patientId, options),
      this.getLabResults(connection, patientId, options),
      this.getVitals(connection, patientId, options),
      this.getBills(connection, patientId, options),
    ]);

    const exportData = {
      patient,
      appointments,
      medicalRecords,
      prescriptions,
      labResults,
      vitals,
      bills,
      exportDate: new Date().toISOString(),
    };

    const recordCount = appointments.length + medicalRecords.length + prescriptions.length + labResults.length + vitals.length + bills.length;

    // Log export
    await this.logExport(connection, patientId, 'json', 'json', options.startDate, options.endDate, null, recordCount, requestedBy, ipAddress, userAgent);

    return { data: exportData, recordCount };
  }

  /**
   * Export patient data as CSV
   */
  async exportCsv(
    patientId: string,
    tenantId: string,
    options: { startDate?: string; endDate?: string; dataType?: string },
    requestedBy: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ csv: string; recordCount: number }> {
    const connection = await this.tenantService.getTenantDatabase(tenantId);
    if (!connection) {
      throw new Error(`Failed to connect to tenant database: ${tenantId}`);
    }

    let csv = '';
    let recordCount = 0;

    if (!options.dataType || options.dataType === 'appointments') {
      const appointments = await this.getAppointments(connection, patientId, options);
      csv += 'Appointments\n';
      csv += 'Date,Type,Status,Reason\n';
      appointments.forEach((apt: any) => {
        const date = apt.appointment_date || apt.appointmentDate;
        const dateStr = date ? new Date(date).toLocaleDateString() : 'N/A';
        csv += `${dateStr},${apt.appointment_type || apt.appointmentType || ''},${apt.status || ''},"${(apt.reason || '').replace(/"/g, '""')}"\n`;
      });
      recordCount += appointments.length;
    }

    if (!options.dataType || options.dataType === 'prescriptions') {
      const prescriptions = await this.getPrescriptions(connection, patientId, options);
      csv += '\nPrescriptions\n';
      csv += 'Medication,Dosage,Frequency,Prescribed Date,Status\n';
      prescriptions.forEach((rx: any) => {
        const medName = (rx.medication_name || rx.medicationName || '').replace(/"/g, '""');
        const dosage = (rx.dosage || '').replace(/"/g, '""');
        const frequency = (rx.frequency || '').replace(/"/g, '""');
        const presDate = rx.prescribed_date || rx.prescribedDate || rx.prescribed_at || rx.created_at;
        const dateStr = presDate ? new Date(presDate).toLocaleDateString() : 'N/A';
        const status = rx.status || '';
        csv += `"${medName}","${dosage}","${frequency}",${dateStr},${status}\n`;
      });
      recordCount += prescriptions.length;
    }

    if (!options.dataType || options.dataType === 'lab_results') {
      const labResults = await this.getLabResults(connection, patientId, options);
      csv += '\nLab Results\n';
      csv += 'Test Name,Result,Unit,Date,Status\n';
      labResults.forEach((lab: any) => {
        const testName = (lab.test_name || lab.testName || '').replace(/"/g, '""');
        const resultValue = (lab.result_value || lab.resultValue || '').replace(/"/g, '""');
        const resultUnit = (lab.unit || lab.result_unit || lab.resultUnit || '').replace(/"/g, '""');
        const refRange = (lab.reference_range || lab.referenceRange || '').replace(/"/g, '""');
        const labDate = lab.result_date || lab.resultDate || lab.test_date || lab.testDate || lab.completed_at || lab.created_at;
        const dateStr = labDate ? new Date(labDate).toLocaleDateString() : 'N/A';
        const status = lab.status || '';
        csv += `"${testName}","${resultValue}","${resultUnit}","${refRange}",${dateStr},${status}\n`;
      });
      recordCount += labResults.length;
    }

    if (!options.dataType || options.dataType === 'vitals') {
      const vitals = await this.getVitals(connection, patientId, options);
      csv += '\nVital Signs\n';
      csv += 'Date,Blood Pressure,Heart Rate,Temperature\n';
      vitals.forEach((vital: any) => {
        const recordedAt = vital.recorded_at || vital.recordedAt;
        const dateStr = recordedAt ? new Date(recordedAt).toLocaleDateString() : 'N/A';
        const bp = vital.blood_pressure || vital.bloodPressure || '';
        const hr = vital.heart_rate || vital.heartRate || '';
        const temp = vital.temperature || '';
        csv += `${dateStr},${bp},${hr},${temp}\n`;
      });
      recordCount += vitals.length;
    }

    // Log export
    await this.logExport(connection, patientId, 'csv', 'csv', options.startDate, options.endDate, null, recordCount, requestedBy, ipAddress, userAgent);

    return { csv, recordCount };
  }

  // Helper methods to fetch data
  private async getAppointments(connection: any, patientId: string, options: { startDate?: string; endDate?: string }): Promise<any[]> {
    let query = `SELECT * FROM appointments WHERE patient_id = $1`;
    const params: any[] = [patientId];
    let paramIndex = 2;

    if (options.startDate) {
      query += ` AND appointment_date >= $${paramIndex}`;
      params.push(options.startDate);
      paramIndex++;
    }
    if (options.endDate) {
      query += ` AND appointment_date <= $${paramIndex}`;
      params.push(options.endDate);
      paramIndex++;
    }

    query += ` ORDER BY appointment_date DESC`;

    return await connection.query(query, params);
  }

  private async getMedicalRecords(connection: any, patientId: string, options: { startDate?: string; endDate?: string }): Promise<any[]> {
    let query = `SELECT * FROM medical_records WHERE patient_id = $1`;
    const params: any[] = [patientId];
    let paramIndex = 2;

    if (options.startDate) {
      query += ` AND visit_date >= $${paramIndex}`;
      params.push(options.startDate);
      paramIndex++;
    }
    if (options.endDate) {
      query += ` AND visit_date <= $${paramIndex}`;
      params.push(options.endDate);
      paramIndex++;
    }

    query += ` ORDER BY visit_date DESC`;

    return await connection.query(query, params);
  }

  private async getPrescriptions(connection: any, patientId: string, options: { startDate?: string; endDate?: string }): Promise<any[]> {
    // prescriptions table has prescribed_date, not prescribed_at
    let query = `SELECT * FROM prescriptions WHERE patient_id = $1`;
    const params: any[] = [patientId];
    let paramIndex = 2;

    // Use prescribed_date or created_at as fallback
    const dateColumn = 'COALESCE(prescribed_date, created_at)';

    if (options.startDate) {
      query += ` AND ${dateColumn} >= $${paramIndex}`;
      params.push(options.startDate);
      paramIndex++;
    }
    if (options.endDate) {
      query += ` AND ${dateColumn} <= $${paramIndex}`;
      params.push(options.endDate);
      paramIndex++;
    }

    query += ` ORDER BY ${dateColumn} DESC`;

    return await connection.query(query, params);
  }

  private async getLabResults(connection: any, patientId: string, options: { startDate?: string; endDate?: string }): Promise<any[]> {
    // lab_results table has: result_date, test_date, created_at (not completed_at)
    // Use result_date or test_date, fallback to created_at
    let query = `SELECT * FROM lab_results WHERE patient_id = $1`;
    const params: any[] = [patientId];
    let paramIndex = 2;

    // Use result_date if available, otherwise test_date, otherwise created_at
    const dateColumn = 'COALESCE(result_date, test_date, created_at)';
    
    if (options.startDate) {
      query += ` AND ${dateColumn} >= $${paramIndex}`;
      params.push(options.startDate);
      paramIndex++;
    }
    if (options.endDate) {
      query += ` AND ${dateColumn} <= $${paramIndex}`;
      params.push(options.endDate);
      paramIndex++;
    }

    query += ` ORDER BY ${dateColumn} DESC`;

    return await connection.query(query, params);
  }

  private async getVitals(connection: any, patientId: string, options: { startDate?: string; endDate?: string }): Promise<any[]> {
    let query = `SELECT * FROM vitals WHERE patient_id = $1`;
    const params: any[] = [patientId];
    let paramIndex = 2;

    if (options.startDate) {
      query += ` AND recorded_at >= $${paramIndex}`;
      params.push(options.startDate);
      paramIndex++;
    }
    if (options.endDate) {
      query += ` AND recorded_at <= $${paramIndex}`;
      params.push(options.endDate);
      paramIndex++;
    }

    query += ` ORDER BY recorded_at DESC`;

    return await connection.query(query, params);
  }

  private async getBills(connection: any, patientId: string, options: { startDate?: string; endDate?: string }): Promise<any[]> {
    // billing table has invoice_date, not billing_date
    let query = `SELECT * FROM billing WHERE patient_id = $1`;
    const params: any[] = [patientId];
    let paramIndex = 2;

    // Use invoice_date or created_at as fallback
    const dateColumn = 'COALESCE(invoice_date::timestamp, created_at)';

    if (options.startDate) {
      query += ` AND ${dateColumn} >= $${paramIndex}`;
      params.push(options.startDate);
      paramIndex++;
    }
    if (options.endDate) {
      query += ` AND ${dateColumn} <= $${paramIndex}`;
      params.push(options.endDate);
      paramIndex++;
    }

    query += ` ORDER BY ${dateColumn} DESC`;

    return await connection.query(query, params);
  }

  private vitalToObservation(vital: any, patientId: string): any {
    const observations: any[] = [];

    if (vital.blood_pressure) {
      const [systolic, diastolic] = vital.blood_pressure.split('/');
      observations.push({
        resourceType: 'Observation',
        id: `bp-${vital.id}`,
        status: 'final',
        code: {
          coding: [{ system: 'http://loinc.org', code: '85354-9', display: 'Blood pressure panel' }],
        },
        subject: { reference: `Patient/${patientId}` },
        effectiveDateTime: vital.recorded_at,
        component: [
          {
            code: { coding: [{ system: 'http://loinc.org', code: '8480-6', display: 'Systolic blood pressure' }] },
            valueQuantity: { value: parseInt(systolic), unit: 'mmHg' },
          },
          {
            code: { coding: [{ system: 'http://loinc.org', code: '8462-4', display: 'Diastolic blood pressure' }] },
            valueQuantity: { value: parseInt(diastolic), unit: 'mmHg' },
          },
        ],
      });
    }

    if (vital.heart_rate) {
      observations.push({
        resourceType: 'Observation',
        id: `hr-${vital.id}`,
        status: 'final',
        code: {
          coding: [{ system: 'http://loinc.org', code: '8867-4', display: 'Heart rate' }],
        },
        subject: { reference: `Patient/${patientId}` },
        effectiveDateTime: vital.recorded_at,
        valueQuantity: { value: vital.heart_rate, unit: 'bpm' },
      });
    }

    if (vital.temperature) {
      observations.push({
        resourceType: 'Observation',
        id: `temp-${vital.id}`,
        status: 'final',
        code: {
          coding: [{ system: 'http://loinc.org', code: '8310-5', display: 'Body temperature' }],
        },
        subject: { reference: `Patient/${patientId}` },
        effectiveDateTime: vital.recorded_at,
        valueQuantity: { value: vital.temperature, unit: 'Cel' },
      });
    }

    return observations.length === 1 ? observations[0] : observations;
  }

  private async logExport(
    connection: any,
    patientId: string,
    exportType: string,
    format: string,
    startDate: string | undefined,
    endDate: string | undefined,
    filePath: string | null,
    recordCount: number,
    requestedBy: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    try {
      await connection.query(
        `INSERT INTO patient_data_exports (
          patient_id, export_type, format, date_range_start, date_range_end,
          file_path, record_count, status, requested_by, ip_address, user_agent, completed_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'completed', $8, $9, $10, NOW())`,
        [patientId, exportType, format, startDate || null, endDate || null, filePath, recordCount, requestedBy, ipAddress || null, userAgent || null],
      );
    } catch (error) {
      this.logger.error(`Failed to log export: ${error.message}`);
    }
  }
}

