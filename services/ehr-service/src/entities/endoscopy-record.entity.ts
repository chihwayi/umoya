import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('endoscopy_record')
export class EndoscopyRecord {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'gastro_register_id', type: 'uuid', nullable: true }) gastroRegisterId: string | null;
  @Column({ name: 'procedure_date', type: 'date' }) procedureDate: string;
  @Column({ name: 'procedure_type', length: 30 }) procedureType: string; // OGD|colonoscopy|flexible_sigmoidoscopy|ERCP|EUS|capsule
  @Column({ name: 'indication', length: 200 }) indication: string;
  @Column({ name: 'endoscopist', length: 100, nullable: true }) endoscopist: string | null;
  @Column({ name: 'quality_indicator', length: 20, nullable: true }) qualityIndicator: string | null; // adequate|inadequate
  @Column({ name: 'bowel_prep', length: 20, nullable: true }) bowelPrep: string | null; // excellent|good|fair|poor
  @Column({ name: 'extent_of_examination', length: 100, nullable: true }) extentOfExamination: string | null;
  @Column({ name: 'findings', type: 'text', nullable: true }) findings: string | null;
  @Column({ name: 'polyps_found', type: 'boolean', default: false }) polypsFound: boolean;
  @Column({ name: 'polyp_count', type: 'integer', nullable: true }) polypCount: number | null;
  @Column({ name: 'polyp_histology', length: 100, nullable: true }) polypHistology: string | null;
  @Column({ name: 'biopsies_taken', type: 'boolean', default: false }) biopsiesTaken: boolean;
  @Column({ name: 'biopsy_sites', length: 200, nullable: true }) biopsySites: string | null;
  @Column({ name: 'h_pylori_tested', type: 'boolean', default: false }) hPyloriTested: boolean;
  @Column({ name: 'h_pylori_result', length: 20, nullable: true }) hPyloriResult: string | null;
  @Column({ name: 'therapeutic_intervention', length: 200, nullable: true }) therapeuticIntervention: string | null;
  @Column({ name: 'complications', type: 'text', nullable: true }) complications: string | null;
  @Column({ name: 'recommendation', type: 'text', nullable: true }) recommendation: string | null;
  @Column({ name: 'next_endoscopy_date', type: 'date', nullable: true }) nextEndoscopyDate: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
