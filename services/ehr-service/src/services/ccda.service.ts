import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Patient } from '../entities/patient.entity';
import { MedicalRecord } from '../entities/medical-record.entity';
import { Prescription, PrescriptionStatus } from '../entities/prescription.entity';
import { LabOrder } from '../entities/lab-order.entity';
import { Allergy } from '../entities/allergy.entity';
import { Problem } from '../entities/problem.entity';
import { Appointment } from '../entities/appointment.entity';
import { Vitals } from '../entities/vitals.entity';
import { User } from '../entities/user.entity';

export interface CcdaDocumentOptions {
  patientId: string;
  documentType: 'CCD' | 'DischargeSummary' | 'ReferralSummary' | 'ProgressNote';
  effectiveTime?: Date;
  authorId?: string;
  encounterId?: string;
  includeSections?: string[];
}

@Injectable()
export class CcdaService {
  private readonly logger = new Logger(CcdaService.name);

  /**
   * Generate Continuity of Care Document (CCD)
   */
  async generateCCD(options: CcdaDocumentOptions, tenantDb: DataSource): Promise<string> {
    const patient = await this.getPatient(options.patientId, tenantDb);
    const author = options.authorId ? await this.getAuthor(options.authorId, tenantDb) : null;
    
    // Gather all clinical data
    const [allergies, problems, medications, labResults, vitals, encounters] = await Promise.all([
      this.getAllergies(options.patientId, tenantDb),
      this.getProblems(options.patientId, tenantDb),
      this.getActiveMedications(options.patientId, tenantDb),
      this.getRecentLabResults(options.patientId, tenantDb),
      this.getRecentVitals(options.patientId, tenantDb),
      this.getRecentEncounters(options.patientId, tenantDb),
    ]);

    const effectiveTime = options.effectiveTime || new Date();
    
    return this.buildCcdaDocument({
      documentType: 'CCD',
      patient,
      author,
      effectiveTime,
      allergies,
      problems,
      medications,
      labResults,
      vitals,
      encounters,
    });
  }

  /**
   * Generate Discharge Summary
   */
  async generateDischargeSummary(options: CcdaDocumentOptions, tenantDb: DataSource): Promise<string> {
    if (!options.encounterId) {
      throw new NotFoundException('Encounter ID is required for discharge summary');
    }

    const patient = await this.getPatient(options.patientId, tenantDb);
    const author = options.authorId ? await this.getAuthor(options.authorId, tenantDb) : null;
    const encounter = await this.getEncounter(options.encounterId, tenantDb);
    
    const [allergies, problems, medications, procedures, labResults] = await Promise.all([
      this.getAllergies(options.patientId, tenantDb),
      this.getProblems(options.patientId, tenantDb),
      this.getActiveMedications(options.patientId, tenantDb),
      this.getProcedures(options.patientId, options.encounterId, tenantDb),
      this.getRecentLabResults(options.patientId, tenantDb),
    ]);

    const effectiveTime = options.effectiveTime || new Date();
    
    return this.buildCcdaDocument({
      documentType: 'DischargeSummary',
      patient,
      author,
      effectiveTime,
      encounter,
      allergies,
      problems,
      medications,
      procedures,
      labResults,
    });
  }

  /**
   * Generate Referral Summary
   */
  async generateReferralSummary(options: CcdaDocumentOptions, tenantDb: DataSource): Promise<string> {
    const patient = await this.getPatient(options.patientId, tenantDb);
    const author = options.authorId ? await this.getAuthor(options.authorId, tenantDb) : null;
    
    const [allergies, problems, medications, labResults, recentEncounters] = await Promise.all([
      this.getAllergies(options.patientId, tenantDb),
      this.getProblems(options.patientId, tenantDb),
      this.getActiveMedications(options.patientId, tenantDb),
      this.getRecentLabResults(options.patientId, tenantDb),
      this.getRecentEncounters(options.patientId, tenantDb, 3),
    ]);

    const effectiveTime = options.effectiveTime || new Date();
    
    return this.buildCcdaDocument({
      documentType: 'ReferralSummary',
      patient,
      author,
      effectiveTime,
      allergies,
      problems,
      medications,
      labResults,
      encounters: recentEncounters,
    });
  }

  /**
   * Generate Progress Note
   */
  async generateProgressNote(options: CcdaDocumentOptions, tenantDb: DataSource): Promise<string> {
    if (!options.encounterId) {
      throw new NotFoundException('Encounter ID is required for progress note');
    }

    const patient = await this.getPatient(options.patientId, tenantDb);
    const author = options.authorId ? await this.getAuthor(options.authorId, tenantDb) : null;
    const encounter = await this.getEncounter(options.encounterId, tenantDb);
    const medicalRecord = await this.getMedicalRecord(options.encounterId, tenantDb);
    
    const [allergies, problems, medications, vitals] = await Promise.all([
      this.getAllergies(options.patientId, tenantDb),
      this.getProblems(options.patientId, tenantDb),
      this.getActiveMedications(options.patientId, tenantDb),
      this.getRecentVitals(options.patientId, tenantDb, 1),
    ]);

    const effectiveTime = options.effectiveTime || new Date();
    
    return this.buildCcdaDocument({
      documentType: 'ProgressNote',
      patient,
      author,
      effectiveTime,
      encounter,
      medicalRecord,
      allergies,
      problems,
      medications,
      vitals,
    });
  }

  // ========== Helper Methods ==========

  private async getPatient(patientId: string, tenantDb: DataSource): Promise<Patient> {
    const patientRepo = tenantDb.getRepository(Patient);
    const patient = await patientRepo.findOne({ where: { id: patientId } });
    if (!patient) {
      throw new NotFoundException(`Patient ${patientId} not found`);
    }
    return patient;
  }

  private async getAuthor(userId: string, tenantDb: DataSource): Promise<User | null> {
    const userRepo = tenantDb.getRepository(User);
    return userRepo.findOne({ where: { id: userId } });
  }

  private async getEncounter(encounterId: string, tenantDb: DataSource): Promise<Appointment | null> {
    const appointmentRepo = tenantDb.getRepository(Appointment);
    return appointmentRepo.findOne({ where: { id: encounterId } });
  }

  private async getMedicalRecord(encounterId: string, tenantDb: DataSource): Promise<MedicalRecord | null> {
    const recordRepo = tenantDb.getRepository(MedicalRecord);
    return recordRepo.findOne({ where: { appointmentId: encounterId } });
  }

  private async getAllergies(patientId: string, tenantDb: DataSource): Promise<Allergy[]> {
    const allergyRepo = tenantDb.getRepository(Allergy);
    return allergyRepo.find({ where: { patientId } });
  }

  private async getProblems(patientId: string, tenantDb: DataSource): Promise<Problem[]> {
    const problemRepo = tenantDb.getRepository(Problem);
    return problemRepo.find({ where: { patientId, status: 'active' } });
  }

  private async getActiveMedications(patientId: string, tenantDb: DataSource): Promise<Prescription[]> {
    // Use raw query to avoid entity column mismatches
    const results = await tenantDb.query(
      `SELECT * FROM prescriptions WHERE patient_id = $1 AND status = $2 ORDER BY created_at DESC LIMIT 20`,
      [patientId, PrescriptionStatus.ACTIVE]
    );
    // Map to Prescription objects manually
    return results.map((row: any) => ({
      id: row.id,
      prescriptionNumber: row.id, // Use ID as fallback
      patientId: row.patient_id,
      doctorId: row.doctor_id,
      medicationName: row.medication_name,
      dosage: row.dosage,
      frequency: row.frequency,
      duration: row.duration,
      status: row.status,
      startDate: row.prescribed_date || row.created_at,
      endDate: null,
      createdAt: row.created_at,
    })) as any[];
  }

  private async getRecentLabResults(patientId: string, tenantDb: DataSource, limit: number = 10): Promise<LabOrder[]> {
    const labRepo = tenantDb.getRepository(LabOrder);
    return labRepo.find({
      where: { patientId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  private async getRecentVitals(patientId: string, tenantDb: DataSource, limit: number = 5): Promise<Vitals[]> {
    const vitalsRepo = tenantDb.getRepository(Vitals);
    return vitalsRepo.find({
      where: { patientId },
      order: { recordedAt: 'DESC' },
      take: limit,
    });
  }

  private async getRecentEncounters(patientId: string, tenantDb: DataSource, limit: number = 5): Promise<Appointment[]> {
    const appointmentRepo = tenantDb.getRepository(Appointment);
    return appointmentRepo.find({
      where: { patientId },
      order: { appointmentDate: 'DESC' },
      take: limit,
    });
  }

  private async getProcedures(patientId: string, encounterId: string, tenantDb: DataSource): Promise<any[]> {
    const recordRepo = tenantDb.getRepository(MedicalRecord);
    const record = await recordRepo.findOne({
      where: { patientId, appointmentId: encounterId },
    });
    
    if (record?.procedures && Array.isArray(record.procedures)) {
      return record.procedures;
    }
    return [];
  }

  // ========== CCDA Document Builder ==========

  private buildCcdaDocument(data: any): string {
    const {
      documentType,
      patient,
      author,
      effectiveTime,
      allergies = [],
      problems = [],
      medications = [],
      labResults = [],
      vitals = [],
      encounters = [],
      encounter,
      medicalRecord,
      procedures = [],
    } = data;

    const docId = this.generateDocumentId();
    const authorName = author ? `${author.firstName} ${author.lastName}` : 'Unknown';
    const authorId = author?.id || 'unknown';
    const orgName = 'Umoya Solutions';
    const orgId = 'umoya';

    // Build CCDA XML document
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ClinicalDocument xmlns="urn:hl7-org:v3" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <realmCode code="US"/>
  <typeId root="2.16.840.1.113883.1.3" extension="POCD_HD000040"/>
  <templateId root="2.16.840.1.113883.10.20.22.1.1" extension="2015-08-01"/>
  <templateId root="2.16.840.1.113883.10.20.22.1.2" extension="2015-08-01"/>
  <id root="${docId}"/>
  <code code="34133-9" codeSystem="2.16.840.1.113883.6.1" codeSystemName="LOINC" displayName="${this.getDocumentTypeName(documentType)}"/>
  <title>${this.getDocumentTypeName(documentType)}</title>
  <effectiveTime value="${this.formatDateTime(effectiveTime)}"/>
  <confidentialityCode code="N" codeSystem="2.16.840.1.113883.5.25"/>
  <languageCode code="en-US"/>
  
  <!-- Record Target (Patient) -->
  <recordTarget>
    <patientRole>
      <id extension="${patient.id}" root="2.16.840.1.113883.3.72.5.9.1"/>
      ${patient.patientNumber ? `<id extension="${patient.patientNumber}" root="2.16.840.1.113883.3.72.5.9.2"/>` : ''}
      ${patient.nationalId ? `<id extension="${patient.nationalId}" root="2.16.840.1.113883.3.72.5.9.3"/>` : ''}
      <patient>
        <name>
          <given>${this.escapeXml(patient.firstName)}</given>
          <family>${this.escapeXml(patient.lastName)}</family>
        </name>
        <administrativeGenderCode code="${this.mapGenderToCcda(patient.gender)}" codeSystem="2.16.840.1.113883.5.1"/>
        <birthTime value="${this.formatDate(patient.dateOfBirth)}"/>
        ${patient.phone ? `<telecom value="tel:${patient.phone}" use="HP"/>` : ''}
        ${patient.email ? `<telecom value="mailto:${patient.email}"/>` : ''}
        ${patient.address ? `<addr>${this.escapeXml(patient.address)}</addr>` : ''}
      </patient>
    </patientRole>
  </recordTarget>

  <!-- Author -->
  <author>
    <time value="${this.formatDateTime(effectiveTime)}"/>
    <assignedAuthor>
      <id extension="${authorId}" root="2.16.840.1.113883.3.72.5.9.4"/>
      <assignedPerson>
        <name>${this.escapeXml(authorName)}</name>
      </assignedPerson>
      <representedOrganization>
        <id root="${orgId}"/>
        <name>${this.escapeXml(orgName)}</name>
      </representedOrganization>
    </assignedAuthor>
  </author>

  <!-- Custodian -->
  <custodian>
    <assignedCustodian>
      <representedCustodianOrganization>
        <id root="${orgId}"/>
        <name>${this.escapeXml(orgName)}</name>
      </representedCustodianOrganization>
    </assignedCustodian>
  </custodian>

  <!-- Document Body -->
  <component>
    <structuredBody>
      ${this.buildAllergiesSection(allergies)}
      ${this.buildProblemsSection(problems)}
      ${this.buildMedicationsSection(medications)}
      ${this.buildResultsSection(labResults)}
      ${this.buildVitalsSection(vitals)}
      ${encounter ? this.buildEncounterSection(encounter, medicalRecord) : ''}
      ${procedures.length > 0 ? this.buildProceduresSection(procedures) : ''}
      ${encounters.length > 0 ? this.buildEncountersSection(encounters) : ''}
    </structuredBody>
  </component>
</ClinicalDocument>`;

    return xml;
  }

  private buildAllergiesSection(allergies: Allergy[]): string {
    if (allergies.length === 0) {
      return `<component>
        <section>
          <templateId root="2.16.840.1.113883.10.20.22.2.6.1"/>
          <code code="48765-2" codeSystem="2.16.840.1.113883.6.1" displayName="Allergies, adverse reactions, alerts"/>
          <title>Allergies, Adverse Reactions, Alerts</title>
          <text>No known allergies documented.</text>
        </section>
      </component>`;
    }

    const entries = allergies.map((allergy, idx) => `
      <entry>
        <act classCode="ACT" moodCode="EVN">
          <templateId root="2.16.840.1.113883.10.20.22.4.30"/>
          <id root="${allergy.id}"/>
          <code code="48765-2" codeSystem="2.16.840.1.113883.6.1" displayName="Allergy"/>
          <statusCode code="completed"/>
          <effectiveTime value="${this.formatDateTime(allergy.recordedAt)}"/>
          <entryRelationship typeCode="SUBJ" inversionInd="false">
            <observation classCode="OBS" moodCode="EVN">
              <templateId root="2.16.840.1.113883.10.20.22.4.7"/>
              <id root="${allergy.id}-obs"/>
              <code code="ASSERTION" codeSystem="2.16.840.1.113883.5.4"/>
              <statusCode code="completed"/>
              <effectiveTime value="${this.formatDateTime(allergy.recordedAt)}"/>
              <value code="${allergy.allergenSnomedCode || 'UNKNOWN'}" 
                     codeSystem="2.16.840.1.113883.6.96" 
                     displayName="${this.escapeXml(allergy.allergen || 'Unknown allergen')}"/>
              ${allergy.reaction ? `<entryRelationship typeCode="MFST">
                <observation classCode="OBS" moodCode="EVN">
                  <code code="ASSERTION" codeSystem="2.16.840.1.113883.5.4"/>
                  <value code="419199007" codeSystem="2.16.840.1.113883.6.96" displayName="${this.escapeXml(allergy.reaction)}"/>
                </observation>
              </entryRelationship>` : ''}
            </observation>
          </entryRelationship>
        </act>
      </entry>`).join('');

    return `<component>
      <section>
        <templateId root="2.16.840.1.113883.10.20.22.2.6.1"/>
        <code code="48765-2" codeSystem="2.16.840.1.113883.6.1" displayName="Allergies, adverse reactions, alerts"/>
        <title>Allergies, Adverse Reactions, Alerts</title>
        <text>
          <list>
            ${allergies.map(a => `<item>${this.escapeXml(a.allergen || 'Unknown')}${a.reaction ? ` - ${this.escapeXml(a.reaction)}` : ''}</item>`).join('')}
          </list>
        </text>
        ${entries}
      </section>
    </component>`;
  }

  private buildProblemsSection(problems: Problem[]): string {
    if (problems.length === 0) {
      return `<component>
        <section>
          <templateId root="2.16.840.1.113883.10.20.22.2.5.1"/>
          <code code="11450-4" codeSystem="2.16.840.1.113883.6.1" displayName="Problem list"/>
          <title>Problems</title>
          <text>No active problems documented.</text>
        </section>
      </component>`;
    }

    const entries = problems.map((problem) => `
      <entry>
        <act classCode="ACT" moodCode="EVN">
          <templateId root="2.16.840.1.113883.10.20.22.4.3"/>
          <id root="${problem.id}"/>
          <code code="CONC" codeSystem="2.16.840.1.113883.5.6"/>
          <statusCode code="${problem.status === 'active' ? 'active' : 'completed'}"/>
          <effectiveTime>
            <low value="${this.formatDate(problem.onsetDate || problem.createdAt)}"/>
            ${problem.resolvedDate ? `<high value="${this.formatDate(problem.resolvedDate)}"/>` : ''}
          </effectiveTime>
          <entryRelationship typeCode="SUBJ">
            <observation classCode="OBS" moodCode="EVN">
              <templateId root="2.16.840.1.113883.10.20.22.4.4"/>
              <id root="${problem.id}-obs"/>
              <code code="64572001" codeSystem="2.16.840.1.113883.6.96" displayName="Condition"/>
              <statusCode code="${problem.status === 'active' ? 'active' : 'completed'}"/>
              <effectiveTime>
                <low value="${this.formatDate(problem.onsetDate || problem.createdAt)}"/>
              </effectiveTime>
              <value code="${problem.snomedConceptId || 'UNKNOWN'}" 
                     codeSystem="2.16.840.1.113883.6.96" 
                     displayName="${this.escapeXml(problem.description || 'Unknown condition')}"/>
            </observation>
          </entryRelationship>
        </act>
      </entry>`).join('');

    return `<component>
      <section>
        <templateId root="2.16.840.1.113883.10.20.22.2.5.1"/>
        <code code="11450-4" codeSystem="2.16.840.1.113883.6.1" displayName="Problem list"/>
        <title>Problems</title>
        <text>
          <list>
            ${problems.map(p => `<item>${this.escapeXml(p.description || 'Unknown')}</item>`).join('')}
          </list>
        </text>
        ${entries}
      </section>
    </component>`;
  }

  private buildMedicationsSection(medications: Prescription[]): string {
    if (medications.length === 0) {
      return `<component>
        <section>
          <templateId root="2.16.840.1.113883.10.20.22.2.1.1"/>
          <code code="10160-0" codeSystem="2.16.840.1.113883.6.1" displayName="History of medication use"/>
          <title>Medications</title>
          <text>No active medications documented.</text>
        </section>
      </component>`;
    }

    const entries = medications.map((med) => `
      <entry>
        <substanceAdministration classCode="SBADM" moodCode="EVN">
          <templateId root="2.16.840.1.113883.10.20.22.4.16"/>
          <id root="${med.id}"/>
          <statusCode code="active"/>
          <effectiveTime>
            <low value="${this.formatDate(med.startDate || med.createdAt)}"/>
            ${med.endDate ? `<high value="${this.formatDate(med.endDate)}"/>` : ''}
          </effectiveTime>
          <consumable>
            <manufacturedProduct>
              <templateId root="2.16.840.1.113883.10.20.22.4.23"/>
              <manufacturedMaterial>
                <code code="${med.medicationNameRxnormCode || med.medicationNameSnomedCode || 'UNKNOWN'}" 
                      codeSystem="${med.medicationNameRxnormCode ? '2.16.840.1.113883.6.88' : '2.16.840.1.113883.6.96'}" 
                      displayName="${this.escapeXml(med.medicationName)}"/>
              </manufacturedMaterial>
            </manufacturedProduct>
          </consumable>
          <doseQuantity value="${this.escapeXml(med.dosage)}"/>
          <rateQuantity value="${this.escapeXml(med.frequency)}"/>
        </substanceAdministration>
      </entry>`).join('');

    return `<component>
      <section>
        <templateId root="2.16.840.1.113883.10.20.22.2.1.1"/>
        <code code="10160-0" codeSystem="2.16.840.1.113883.6.1" displayName="History of medication use"/>
        <title>Medications</title>
        <text>
          <list>
            ${medications.map(m => `<item>${this.escapeXml(m.medicationName)} - ${this.escapeXml(m.dosage)} ${this.escapeXml(m.frequency)}</item>`).join('')}
          </list>
        </text>
        ${entries}
      </section>
    </component>`;
  }

  private buildResultsSection(labResults: LabOrder[]): string {
    if (labResults.length === 0) {
      return '';
    }

    const entries = labResults
      .filter(lab => lab.results && Object.keys(lab.results).length > 0)
      .map((lab) => {
        const tests = Array.isArray(lab.tests) ? lab.tests : [];
        return tests.map((test: any, idx: number) => `
          <entry>
            <organizer classCode="BATTERY" moodCode="EVN">
              <templateId root="2.16.840.1.113883.10.20.22.4.1"/>
              <id root="${lab.id}-${idx}"/>
              <statusCode code="completed"/>
              <effectiveTime value="${this.formatDateTime(lab.collectedAt || lab.createdAt)}"/>
              <component>
                <observation classCode="OBS" moodCode="EVN">
                  <templateId root="2.16.840.1.113883.10.20.22.4.2"/>
                  <id root="${lab.id}-obs-${idx}"/>
                  <code code="${test.testCode || test.loincCode || 'UNKNOWN'}" 
                        codeSystem="${test.loincCode ? '2.16.840.1.113883.6.1' : '2.16.840.1.113883.6.96'}" 
                        displayName="${this.escapeXml(test.testName || 'Unknown test')}"/>
                  <statusCode code="completed"/>
                  <effectiveTime value="${this.formatDateTime(lab.collectedAt || lab.createdAt)}"/>
                  <value xsi:type="PQ" value="${test.resultValue || ''}" unit="${test.unit || ''}"/>
                  ${test.referenceRange ? `<referenceRange>
                    <observationRange>
                      <text>${this.escapeXml(test.referenceRange)}</text>
                    </observationRange>
                  </referenceRange>` : ''}
                </observation>
              </component>
            </organizer>
          </entry>`).join('');
      })
      .join('');

    if (!entries) {
      return '';
    }

    return `<component>
      <section>
        <templateId root="2.16.840.1.113883.10.20.22.2.3.1"/>
        <code code="30954-2" codeSystem="2.16.840.1.113883.6.1" displayName="Relevant diagnostic tests"/>
        <title>Results</title>
        <text>
          <list>
            ${labResults
              .filter(lab => lab.results && Object.keys(lab.results).length > 0)
              .map(lab => {
                const tests = Array.isArray(lab.tests) ? lab.tests : [];
                return tests.map((test: any) => 
                  `<item>${this.escapeXml(test.testName || 'Unknown')}: ${test.resultValue || 'N/A'} ${test.unit || ''}</item>`
                ).join('');
              })
              .join('')}
          </list>
        </text>
        ${entries}
      </section>
    </component>`;
  }

  private buildVitalsSection(vitals: Vitals[]): string {
    if (vitals.length === 0) {
      return '';
    }

    const entries = vitals.map((vital) => `
      <entry>
        <organizer classCode="BATTERY" moodCode="EVN">
          <templateId root="2.16.840.1.113883.10.20.22.4.26"/>
          <id root="${vital.id}"/>
          <statusCode code="completed"/>
          <effectiveTime value="${this.formatDateTime(vital.recordedAt)}"/>
          ${vital.bloodPressure ? `<component>
            <observation classCode="OBS" moodCode="EVN">
              <code code="85354-9" codeSystem="2.16.840.1.113883.6.1" displayName="Blood pressure"/>
              <value xsi:type="PQ" value="${this.escapeXml(vital.bloodPressure)}" unit="mm[Hg]"/>
            </observation>
          </component>` : ''}
          ${vital.heartRate ? `<component>
            <observation classCode="OBS" moodCode="EVN">
              <code code="8867-4" codeSystem="2.16.840.1.113883.6.1" displayName="Heart rate"/>
              <value xsi:type="PQ" value="${vital.heartRate}" unit="/min"/>
            </observation>
          </component>` : ''}
          ${vital.temperature ? `<component>
            <observation classCode="OBS" moodCode="EVN">
              <code code="8310-5" codeSystem="2.16.840.1.113883.6.1" displayName="Body temperature"/>
              <value xsi:type="PQ" value="${vital.temperature}" unit="Cel"/>
            </observation>
          </component>` : ''}
          ${vital.oxygenSaturation ? `<component>
            <observation classCode="OBS" moodCode="EVN">
              <code code="2708-6" codeSystem="2.16.840.1.113883.6.1" displayName="Oxygen saturation"/>
              <value xsi:type="PQ" value="${vital.oxygenSaturation}" unit="%"/>
            </observation>
          </component>` : ''}
          ${vital.weight ? `<component>
            <observation classCode="OBS" moodCode="EVN">
              <code code="29463-7" codeSystem="2.16.840.1.113883.6.1" displayName="Body weight"/>
              <value xsi:type="PQ" value="${vital.weight}" unit="kg"/>
            </observation>
          </component>` : ''}
        </organizer>
      </entry>`).join('');

    return `<component>
      <section>
        <templateId root="2.16.840.1.113883.10.20.22.2.4.1"/>
        <code code="8716-3" codeSystem="2.16.840.1.113883.6.1" displayName="Vital signs"/>
        <title>Vital Signs</title>
        <text>
          <list>
            ${vitals.map(v => `<item>${this.formatDateTime(v.recordedAt)}: ${v.bloodPressure || 'N/A'} / ${v.heartRate || 'N/A'} bpm / ${v.temperature || 'N/A'}°C</item>`).join('')}
          </list>
        </text>
        ${entries}
      </section>
    </component>`;
  }

  private buildEncounterSection(encounter: Appointment, medicalRecord?: MedicalRecord | null): string {
    if (!encounter) {
      return '';
    }

    return `<component>
      <section>
        <templateId root="2.16.840.1.113883.10.20.22.2.22.1"/>
        <code code="46240-8" codeSystem="2.16.840.1.113883.6.1" displayName="History of encounters"/>
        <title>Encounter</title>
        <text>
          <paragraph>
            <content>Encounter Date: ${this.formatDateTime(encounter.appointmentDate)}</content>
            ${encounter.reason ? `<content>Reason: ${this.escapeXml(encounter.reason)}</content>` : ''}
            ${medicalRecord?.chiefComplaint ? `<content>Chief Complaint: ${this.escapeXml(medicalRecord.chiefComplaint)}</content>` : ''}
            ${medicalRecord?.assessment ? `<content>Assessment: ${this.escapeXml(medicalRecord.assessment)}</content>` : ''}
            ${medicalRecord?.plan ? `<content>Plan: ${this.escapeXml(medicalRecord.plan)}</content>` : ''}
          </paragraph>
        </text>
        <entry>
          <encounter classCode="ENC" moodCode="EVN">
            <templateId root="2.16.840.1.113883.10.20.22.4.49"/>
            <id root="${encounter.id}"/>
            <code code="AMB" codeSystem="2.16.840.1.113883.5.4" displayName="Ambulatory"/>
            <effectiveTime value="${this.formatDateTime(encounter.appointmentDate)}"/>
            ${medicalRecord?.chiefComplaint ? `<entryRelationship typeCode="RSON">
              <act classCode="ACT" moodCode="EVN">
                <code code="409073007" codeSystem="2.16.840.1.113883.6.96" displayName="${this.escapeXml(medicalRecord.chiefComplaint)}"/>
              </act>
            </entryRelationship>` : ''}
          </encounter>
        </entry>
      </section>
    </component>`;
  }

  private buildProceduresSection(procedures: any[]): string {
    if (procedures.length === 0) {
      return '';
    }

    const entries = procedures.map((proc, idx) => `
      <entry>
        <procedure classCode="PROC" moodCode="EVN">
          <templateId root="2.16.840.1.113883.10.20.22.4.14"/>
          <id root="proc-${idx}"/>
          <code code="${proc.code || 'UNKNOWN'}" 
                codeSystem="2.16.840.1.113883.6.96" 
                displayName="${this.escapeXml(proc.description || 'Unknown procedure')}"/>
          <statusCode code="completed"/>
          <effectiveTime value="${this.formatDateTime(proc.date || new Date())}"/>
        </procedure>
      </entry>`).join('');

    return `<component>
      <section>
        <templateId root="2.16.840.1.113883.10.20.22.2.7.1"/>
        <code code="47519-4" codeSystem="2.16.840.1.113883.6.1" displayName="History of procedures"/>
        <title>Procedures</title>
        <text>
          <list>
            ${procedures.map(p => `<item>${this.escapeXml(p.description || 'Unknown')}</item>`).join('')}
          </list>
        </text>
        ${entries}
      </section>
    </component>`;
  }

  private buildEncountersSection(encounters: Appointment[]): string {
    if (encounters.length === 0) {
      return '';
    }

    const entries = encounters.map((encounter) => `
      <entry>
        <encounter classCode="ENC" moodCode="EVN">
          <templateId root="2.16.840.1.113883.10.20.22.4.49"/>
          <id root="${encounter.id}"/>
          <code code="AMB" codeSystem="2.16.840.1.113883.5.4" displayName="Ambulatory"/>
          <effectiveTime value="${this.formatDateTime(encounter.appointmentDate)}"/>
          ${encounter.reason ? `<entryRelationship typeCode="RSON">
            <act classCode="ACT" moodCode="EVN">
              <code displayName="${this.escapeXml(encounter.reason)}"/>
            </act>
          </entryRelationship>` : ''}
        </encounter>
      </entry>`).join('');

    return `<component>
      <section>
        <templateId root="2.16.840.1.113883.10.20.22.2.22.1"/>
        <code code="46240-8" codeSystem="2.16.840.1.113883.6.1" displayName="History of encounters"/>
        <title>Encounters</title>
        <text>
          <list>
            ${encounters.map(e => `<item>${this.formatDateTime(e.appointmentDate)}: ${this.escapeXml(e.reason || 'Visit')}</item>`).join('')}
          </list>
        </text>
        ${entries}
      </section>
    </component>`;
  }

  // ========== Utility Methods ==========

  private generateDocumentId(): string {
    return `2.16.840.1.113883.3.72.5.9.${Date.now()}`;
  }

  private getDocumentTypeName(documentType: string): string {
    const names: Record<string, string> = {
      CCD: 'Continuity of Care Document',
      DischargeSummary: 'Discharge Summary',
      ReferralSummary: 'Referral Summary',
      ProgressNote: 'Progress Note',
    };
    return names[documentType] || 'Clinical Document';
  }

  private formatDate(date: Date | string | null | undefined): string {
    if (!date) return '';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toISOString().split('T')[0].replace(/-/g, '');
  }

  private formatDateTime(date: Date | string | null | undefined): string {
    if (!date) return '';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toISOString().replace(/[-:]/g, '').split('.')[0];
  }

  private mapGenderToCcda(gender: string | null | undefined): string {
    if (!gender) return 'UN';
    const map: Record<string, string> = {
      male: 'M',
      female: 'F',
      other: 'UN',
    };
    return map[gender.toLowerCase()] || 'UN';
  }

  private escapeXml(text: string | null | undefined): string {
    if (!text) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}

