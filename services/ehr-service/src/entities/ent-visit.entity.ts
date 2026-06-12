import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('ent_visit')
export class EntVisit {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'encounter_id', type: 'uuid', nullable: true }) encounterId: string | null;
  @Column({ name: 'clinician_id', type: 'uuid', nullable: true }) clinicianId: string | null;
  @Column({ name: 'visit_date', type: 'date' }) visitDate: string;
  @Column({ name: 'chief_complaint', length: 200 }) chiefComplaint: string;
  @Column({ name: 'subspecialty', length: 20, nullable: true }) subspecialty: string | null; // ear|nose|throat|head_neck
  // Ear
  @Column({ name: 'ear_right_tympanic', length: 50, nullable: true }) earRightTympanic: string | null;
  @Column({ name: 'ear_left_tympanic', length: 50, nullable: true }) earLeftTympanic: string | null;
  @Column({ name: 'hearing_loss_right', type: 'boolean', nullable: true }) hearingLossRight: boolean | null;
  @Column({ name: 'hearing_loss_left', type: 'boolean', nullable: true }) hearingLossLeft: boolean | null;
  @Column({ name: 'hearing_loss_type', length: 30, nullable: true }) hearingLossType: string | null; // conductive|sensorineural|mixed
  // Nose
  @Column({ name: 'nasal_obstruction', type: 'boolean', default: false }) nasalObstruction: boolean;
  @Column({ name: 'septal_deviation', type: 'boolean', default: false }) septalDeviation: boolean;
  @Column({ name: 'nasal_polyps', type: 'boolean', default: false }) nasalPolyps: boolean;
  // Throat
  @Column({ name: 'tonsil_grade', length: 5, nullable: true }) tonsilGrade: string | null; // 0|I|II|III|IV
  @Column({ name: 'oropharynx_findings', type: 'text', nullable: true }) oropharynxFindings: string | null;
  @Column({ name: 'voice_quality', length: 30, nullable: true }) voiceQuality: string | null; // normal|hoarse|breathy|strained
  // Diagnosis
  @Column({ name: 'primary_diagnosis', length: 200, nullable: true }) primaryDiagnosis: string | null;
  @Column({ name: 'icd10_code', length: 20, nullable: true }) icd10Code: string | null;
  @Column({ name: 'management_plan', type: 'text', nullable: true }) managementPlan: string | null;
  @Column({ name: 'referral_for_procedure', type: 'boolean', default: false }) referralForProcedure: boolean;
  @Column({ name: 'procedure_type', length: 50, nullable: true }) procedureType: string | null;
  @Column({ name: 'follow_up_date', type: 'date', nullable: true }) followUpDate: string | null;
  @Column({ type: 'text', nullable: true }) notes: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
