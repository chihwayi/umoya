import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('orthopaedic_register')
export class OrthopaedicRegister {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'encounter_id', type: 'uuid', nullable: true }) encounterId: string | null;
  @Column({ name: 'registered_by', type: 'uuid' }) registeredBy: string;
  @Column({ name: 'primary_diagnosis', length: 200 }) primaryDiagnosis: string;
  @Column({ name: 'icd10_code', length: 20, nullable: true }) icd10Code: string | null;
  @Column({ name: 'diagnosis_date', type: 'date' }) diagnosisDate: string;
  @Column({ name: 'laterality', length: 10, nullable: true }) laterality: string | null; // left|right|bilateral
  @Column({ name: 'body_region', length: 50, nullable: true }) bodyRegion: string | null; // spine|hip|knee|shoulder|ankle|foot|hand|wrist|elbow
  @Column({ name: 'mechanism_of_injury', length: 100, nullable: true }) mechanismOfInjury: string | null;
  @Column({ name: 'injury_date', type: 'date', nullable: true }) injuryDate: string | null;
  @Column({ name: 'ao_classification', length: 20, nullable: true }) aoClassification: string | null;
  @Column({ name: 'has_neurovascular_compromise', type: 'boolean', default: false }) hasNeurovascularCompromise: boolean;
  @Column({ name: 'is_open_fracture', type: 'boolean', default: false }) isOpenFracture: boolean;
  @Column({ name: 'gustilo_grade', length: 5, nullable: true }) gustiloGrade: string | null; // I|IIA|IIB|IIIA|IIIB|IIIC
  @Column({ name: 'treatment_approach', length: 30, nullable: true }) treatmentApproach: string | null; // conservative|operative
  @Column({ name: 'status', length: 20, default: 'active' }) status: string; // active|post_op|rehabilitation|discharged
  @Column({ name: 'next_review_date', type: 'date', nullable: true }) nextReviewDate: string | null;
  @Column({ type: 'text', nullable: true }) notes: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
