import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('gastro_register')
export class GastroRegister {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'registered_by', type: 'uuid' }) registeredBy: string;
  @Column({ name: 'primary_diagnosis', length: 200 }) primaryDiagnosis: string;
  @Column({ name: 'icd10_code', length: 20, nullable: true }) icd10Code: string | null;
  @Column({ name: 'diagnosis_date', type: 'date' }) diagnosisDate: string;
  @Column({ name: 'gi_region', length: 20, nullable: true }) giRegion: string | null; // upper|lower|both|hepatobiliary|pancreatic
  @Column({ name: 'helicobacter_pylori_status', length: 20, nullable: true }) helicobacterPyloriStatus: string | null; // positive|negative|untested
  @Column({ name: 'has_cirrhosis', type: 'boolean', default: false }) hasCirrhosis: boolean;
  @Column({ name: 'child_pugh_score', length: 5, nullable: true }) childPughScore: string | null; // A|B|C
  @Column({ name: 'has_ibd', type: 'boolean', default: false }) hasIbd: boolean;
  @Column({ name: 'ibd_type', length: 20, nullable: true }) ibdType: string | null; // crohns|ulcerative_colitis|indeterminate
  @Column({ name: 'on_immunosuppression', type: 'boolean', default: false }) onImmunosuppression: boolean;
  @Column({ name: 'immunosuppressive_agent', length: 100, nullable: true }) immunosuppressiveAgent: string | null;
  @Column({ name: 'colon_cancer_screening_due', type: 'boolean', default: false }) colonCancerScreeningDue: boolean;
  @Column({ name: 'last_colonoscopy_date', type: 'date', nullable: true }) lastColonoscopyDate: string | null;
  @Column({ name: 'next_endoscopy_date', type: 'date', nullable: true }) nextEndoscopyDate: string | null;
  @Column({ name: 'status', length: 20, default: 'active' }) status: string;
  @Column({ type: 'text', nullable: true }) notes: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
