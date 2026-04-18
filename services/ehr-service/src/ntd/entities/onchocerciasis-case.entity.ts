import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'onchocerciasis_cases' })
export class OnchocerciasisCase {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id' }) patientId: string;
  @Column({ name: 'registered_by' }) registeredBy: string;
  @Column({ name: 'registration_date', type: 'date' }) registrationDate: string;
  @Column({ name: 'ov16_serology', nullable: true }) ov16Serology: string;
  @Column({ name: 'ov16_test_date', type: 'date', nullable: true }) ov16TestDate: string;
  @Column({ name: 'skin_snip_result', nullable: true }) skinSnipResult: string;
  @Column({ name: 'skin_snip_sites', nullable: true }) skinSnipSites: string;
  @Column({ name: 'microfilaria_per_mg_skin', type: 'decimal', precision: 8, scale: 2, nullable: true }) microfilariaPerMgSkin: number;
  @Column({ name: 'ocular_involvement', default: false }) ocularInvolvement: boolean;
  @Column({ name: 'ocular_findings', nullable: true }) ocularFindings: string;
  @Column({ name: 'visual_acuity_right', nullable: true }) visualAcuityRight: string;
  @Column({ name: 'visual_acuity_left', nullable: true }) visualAcuityLeft: string;
  @Column({ name: 'skin_disease', nullable: true }) skinDisease: string;
  @Column({ name: 'nodule_count', nullable: true }) noduleCount: number;
  @Column({ name: 'ivermectin_dose_mg', type: 'decimal', precision: 5, scale: 2, nullable: true }) ivermectinDoseMg: number;
  @Column({ name: 'mda_round', nullable: true }) mdaRound: number;
  @Column({ name: 'last_ivermectin_date', type: 'date', nullable: true }) lastIvermectinDate: string;
  @Column({ name: 'ivermectin_administered_by', nullable: true }) ivermectinAdministeredBy: string;
  @Column({ name: 'adverse_reactions', type: 'jsonb', default: [] }) adverseReactions: any[];
  @Column({ name: 'cdti_village', nullable: true }) cdtiVillage: string;
  @Column({ name: 'espen_programme', nullable: true }) espenProgramme: string;
  @Column({ name: 'follow_up_required', default: true }) followUpRequired: boolean;
  @Column({ name: 'outcome', nullable: true }) outcome: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
