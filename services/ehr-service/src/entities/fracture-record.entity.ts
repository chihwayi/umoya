import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('fracture_record')
export class FractureRecord {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'orthopaedic_register_id', type: 'uuid', nullable: true }) orthopaedicRegisterId: string | null;
  @Column({ name: 'fracture_site', length: 100 }) fractureSite: string;
  @Column({ name: 'fracture_type', length: 50 }) fractureType: string; // transverse|oblique|spiral|comminuted|avulsion|stress|pathological
  @Column({ name: 'ao_classification', length: 20, nullable: true }) aoClassification: string | null;
  @Column({ name: 'is_open', type: 'boolean', default: false }) isOpen: boolean;
  @Column({ name: 'gustilo_grade', length: 5, nullable: true }) gustiloGrade: string | null;
  @Column({ name: 'neurovascular_status', length: 30, nullable: true }) neurovascularStatus: string | null; // intact|compromised|absent
  @Column({ name: 'management', length: 50, nullable: true }) management: string | null; // conservative|im_nail|plating|external_fixator|arthroplasty
  @Column({ name: 'operation_date', type: 'date', nullable: true }) operationDate: string | null;
  @Column({ name: 'surgeon_name', length: 100, nullable: true }) surgeonName: string | null;
  @Column({ name: 'implant_used', length: 100, nullable: true }) implantUsed: string | null;
  @Column({ name: 'weight_bearing_status', length: 30, nullable: true }) weightBearingStatus: string | null; // nwb|ttwb|pwb|fwb
  @Column({ name: 'union_status', length: 20, nullable: true }) unionStatus: string | null; // healing|delayed_union|non_union|malunion
  @Column({ name: 'complications', type: 'text', nullable: true }) complications: string | null;
  @Column({ name: 'outcome_score', type: 'numeric', precision: 4, scale: 1, nullable: true }) outcomeScore: number | null;
  @Column({ name: 'outcome_tool', length: 30, nullable: true }) outcomeTool: string | null; // DASH|Oxford|PROMS|WOMAC
  @Column({ type: 'text', nullable: true }) notes: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
