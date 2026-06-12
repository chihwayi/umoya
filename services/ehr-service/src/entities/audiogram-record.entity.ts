import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('audiogram_record')
export class AudiogramRecord {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'test_date', type: 'date' }) testDate: string;
  @Column({ name: 'test_type', length: 30 }) testType: string; // pure_tone|tympanometry|ABR|OAE|speech
  // Pure-tone thresholds dB HL — air conduction
  @Column({ name: 'r_500hz_ac', type: 'numeric', precision: 4, scale: 0, nullable: true }) r500hzAc: number | null;
  @Column({ name: 'r_1000hz_ac', type: 'numeric', precision: 4, scale: 0, nullable: true }) r1000hzAc: number | null;
  @Column({ name: 'r_2000hz_ac', type: 'numeric', precision: 4, scale: 0, nullable: true }) r2000hzAc: number | null;
  @Column({ name: 'r_4000hz_ac', type: 'numeric', precision: 4, scale: 0, nullable: true }) r4000hzAc: number | null;
  @Column({ name: 'l_500hz_ac', type: 'numeric', precision: 4, scale: 0, nullable: true }) l500hzAc: number | null;
  @Column({ name: 'l_1000hz_ac', type: 'numeric', precision: 4, scale: 0, nullable: true }) l1000hzAc: number | null;
  @Column({ name: 'l_2000hz_ac', type: 'numeric', precision: 4, scale: 0, nullable: true }) l2000hzAc: number | null;
  @Column({ name: 'l_4000hz_ac', type: 'numeric', precision: 4, scale: 0, nullable: true }) l4000hzAc: number | null;
  // PTA (pure tone average 500+1k+2k+4k / 4)
  @Column({ name: 'pta_right_db', type: 'numeric', precision: 4, scale: 1, nullable: true }) ptaRightDb: number | null;
  @Column({ name: 'pta_left_db', type: 'numeric', precision: 4, scale: 1, nullable: true }) ptaLeftDb: number | null;
  @Column({ name: 'classification_right', length: 30, nullable: true }) classificationRight: string | null; // normal|mild|moderate|severe|profound
  @Column({ name: 'classification_left', length: 30, nullable: true }) classificationLeft: string | null;
  @Column({ name: 'hearing_aid_recommended', type: 'boolean', default: false }) hearingAidRecommended: boolean;
  @Column({ name: 'cochlear_implant_considered', type: 'boolean', default: false }) cochlearImplantConsidered: boolean;
  @Column({ name: 'tympanogram_right', length: 20, nullable: true }) tympanogramRight: string | null; // type_A|type_B|type_C
  @Column({ name: 'tympanogram_left', length: 20, nullable: true }) tympanogramLeft: string | null;
  @Column({ type: 'text', nullable: true }) interpretation: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
