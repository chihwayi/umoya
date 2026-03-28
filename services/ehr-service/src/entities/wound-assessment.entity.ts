import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('wound_assessments')
export class WoundAssessment {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'assessed_by', type: 'uuid' }) assessedBy: string;
  @Column({ name: 'assessment_date', type: 'timestamptz' }) assessmentDate: Date;
  @Column({ name: 'wound_type', type: 'text' }) woundType: string;
  @Column({ type: 'text' }) location: string;
  @Column({ name: 'length_cm', type: 'numeric', precision: 5, scale: 2, nullable: true }) lengthCm: number;
  @Column({ name: 'width_cm', type: 'numeric', precision: 5, scale: 2, nullable: true }) widthCm: number;
  @Column({ name: 'depth_cm', type: 'numeric', precision: 5, scale: 2, nullable: true }) depthCm: number;
  @Column({ name: 'tunnelling_cm', type: 'numeric', precision: 5, scale: 2, nullable: true }) tunnellingCm: number;
  @Column({ type: 'text', nullable: true }) undermining: string;
  @Column({ name: 'tissue_type', type: 'jsonb', default: '{}' }) tissueType: any;
  @Column({ name: 'exudate_amount', type: 'text', nullable: true }) exudateAmount: string;
  @Column({ name: 'exudate_type', type: 'text', nullable: true }) exudateType: string;
  @Column({ type: 'text', nullable: true }) odour: string;
  @Column({ type: 'text', nullable: true }) periwound: string;
  @Column({ name: 'infection_signs', type: 'boolean', default: false }) infectionSigns: boolean;
  @Column({ name: 'push_score', type: 'smallint', nullable: true }) pushScore: number;
  @Column({ name: 'bwat_score', type: 'smallint', nullable: true }) bwatScore: number;
  @Column({ name: 'treatment_plan', type: 'text', nullable: true }) treatmentPlan: string;
  @Column({ name: 'dressing_used', type: 'text', nullable: true }) dressingUsed: string;
  @Column({ name: 'review_date', type: 'date', nullable: true }) reviewDate: string;
  @Column({ name: 'wound_photograph', type: 'text', nullable: true }) woundPhotograph: string;
  @Column({ type: 'text', nullable: true }) notes: string;  @Column({ name: 'admission_id', type: 'uuid', nullable: true })
  admissionId?: string;

  @Column({ name: 'braden_score', type: 'int', nullable: true })
  bradenScore?: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  stage?: string;

  @Column({ name: 'wound_location', type: 'varchar', length: 255 })
  woundLocation: string;


  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
