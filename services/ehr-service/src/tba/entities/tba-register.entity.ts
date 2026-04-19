import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { HomeBirthRecord } from './home-birth-record.entity';

@Entity({ name: 'tba_register' })
export class TbaRegister {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tba_code', unique: true }) tbaCode: string;
  @Column({ name: 'full_name' }) fullName: string;
  @Column({ name: 'sex', default: 'female' }) sex: string;
  @Column({ name: 'date_of_birth', type: 'date', nullable: true }) dateOfBirth: string;
  @Column({ name: 'phone', nullable: true }) phone: string;
  @Column({ name: 'village' }) village: string;
  @Column({ name: 'ward', nullable: true }) ward: string;
  @Column({ name: 'district' }) district: string;
  @Column({ name: 'registration_date', type: 'date' }) registrationDate: string;
  @Column({ name: 'registration_status', default: 'active' }) registrationStatus: string;
  @Column({ name: 'trained', default: false }) trained: boolean;
  @Column({ name: 'training_type', nullable: true }) trainingType: string;
  @Column({ name: 'last_training_date', type: 'date', nullable: true }) lastTrainingDate: string;
  @Column({ name: 'training_institution', nullable: true }) trainingInstitution: string;
  @Column({ name: 'assigned_chw_id', nullable: true }) assignedChwId: string;
  @Column({ name: 'assigned_facility_id', nullable: true }) assignedFacilityId: string;
  @Column({ name: 'supervising_midwife_id', nullable: true }) supervisingMidwifeId: string;
  @Column({ name: 'last_supervision_date', type: 'date', nullable: true }) lastSupervisionDate: string;
  @Column({ name: 'supervision_score', nullable: true }) supervisionScore: number;
  @Column({ name: 'supervision_risk', nullable: true }) supervisionRisk: string;
  @Column({ name: 'total_deliveries', default: 0 }) totalDeliveries: number;
  @Column({ name: 'maternal_deaths', default: 0 }) maternalDeaths: number;
  @Column({ name: 'neonatal_deaths', default: 0 }) neonatalDeaths: number;
  @Column({ name: 'referrals_made', default: 0 }) referralsMade: number;
  @Column({ name: 'registered_by', nullable: true }) registeredBy: string;
  @OneToMany(() => HomeBirthRecord, (birth) => birth.tba) births: HomeBirthRecord[];
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
