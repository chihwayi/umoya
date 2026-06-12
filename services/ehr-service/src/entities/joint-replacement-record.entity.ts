import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('joint_replacement_record')
export class JointReplacementRecord {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'orthopaedic_register_id', type: 'uuid', nullable: true }) orthopaedicRegisterId: string | null;
  @Column({ name: 'joint', length: 30 }) joint: string; // hip|knee|shoulder|ankle|elbow|wrist
  @Column({ name: 'laterality', length: 10 }) laterality: string; // left|right
  @Column({ name: 'replacement_type', length: 30 }) replacementType: string; // THA|TKA|UKA|TSA|revision
  @Column({ name: 'indication', length: 100 }) indication: string;
  @Column({ name: 'operation_date', type: 'date' }) operationDate: string;
  @Column({ name: 'prosthesis_manufacturer', length: 100, nullable: true }) prosthesisMaufacturer: string | null;
  @Column({ name: 'prosthesis_model', length: 100, nullable: true }) prosthesisModel: string | null;
  @Column({ name: 'fixation_type', length: 20, nullable: true }) fixationType: string | null; // cemented|uncemented|hybrid
  @Column({ name: 'bearing_surface', length: 30, nullable: true }) bearingSurface: string | null; // metal_poly|ceramic_poly|ceramic_ceramic
  @Column({ name: 'approach', length: 50, nullable: true }) approach: string | null;
  @Column({ name: 'surgeon_name', length: 100, nullable: true }) surgeonName: string | null;
  @Column({ name: 'intraop_complications', type: 'text', nullable: true }) intraopComplications: string | null;
  @Column({ name: 'postop_complications', type: 'text', nullable: true }) postopComplications: string | null;
  @Column({ name: 'pre_op_score', type: 'numeric', precision: 5, scale: 1, nullable: true }) preOpScore: number | null;
  @Column({ name: 'post_op_score', type: 'numeric', precision: 5, scale: 1, nullable: true }) postOpScore: number | null;
  @Column({ name: 'outcome_tool', length: 30, nullable: true }) outcomeTool: string | null; // OHS|OKS|WOMAC|Oxford
  @Column({ name: 'revision_required', type: 'boolean', default: false }) revisionRequired: boolean;
  @Column({ name: 'revision_date', type: 'date', nullable: true }) revisionDate: string | null;
  @Column({ name: 'revision_reason', length: 100, nullable: true }) revisionReason: string | null;
  @Column({ type: 'text', nullable: true }) notes: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
