import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'leprosy_cases' })
export class LeprosyCase {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id' }) patientId: string;
  @Column({ name: 'registered_by' }) registeredBy: string;
  @Column({ name: 'registration_date', type: 'date' }) registrationDate: string;
  @Column({ name: 'classification' }) classification: string;
  @Column({ name: 'ridley_jopling_type', nullable: true }) ridleyJoplingType: string;
  @Column({ name: 'bacteriological_index', type: 'decimal', precision: 3, scale: 1, nullable: true }) bacteriologicalIndex: number;
  @Column({ name: 'skin_smear_sites', nullable: true }) skinSmearSites: number;
  @Column({ name: 'right_eye_grade', nullable: true }) rightEyeGrade: number;
  @Column({ name: 'left_eye_grade', nullable: true }) leftEyeGrade: number;
  @Column({ name: 'right_hand_grade', nullable: true }) rightHandGrade: number;
  @Column({ name: 'left_hand_grade', nullable: true }) leftHandGrade: number;
  @Column({ name: 'right_foot_grade', nullable: true }) rightFootGrade: number;
  @Column({ name: 'left_foot_grade', nullable: true }) leftFootGrade: number;
  @Column({ name: 'max_disability_grade', nullable: true }) maxDisabilityGrade: number;
  @Column({ name: 'nfi_present', default: false }) nfiPresent: boolean;
  @Column({ name: 'nfi_nerves_affected', type: 'jsonb', default: [] }) nfiNervesAffected: string[];
  @Column({ name: 'nfi_motor_loss', default: false }) nfiMotorLoss: boolean;
  @Column({ name: 'nfi_sensory_loss', default: false }) nfiSensoryLoss: boolean;
  @Column({ name: 'mdt_regimen' }) mdtRegimen: string;
  @Column({ name: 'mdt_start_date', type: 'date', nullable: true }) mdtStartDate: string;
  @Column({ name: 'mdt_expected_completion', type: 'date', nullable: true }) mdtExpectedCompletion: string;
  @Column({ name: 'mdt_completed_date', type: 'date', nullable: true }) mdtCompletedDate: string;
  @Column({ name: 'rft_date', type: 'date', nullable: true }) rftDate: string;
  @Column({ name: 'monthly_supervised_doses', default: 0 }) monthlySupervisedDoses: number;
  @Column({ name: 'self_administered_doses', default: 0 }) selfAdministeredDoses: number;
  @Column({ name: 'doses_missed', default: 0 }) dosesMissed: number;
  @Column({ name: 'reaction_type', nullable: true }) reactionType: string;
  @Column({ name: 'reaction_start_date', type: 'date', nullable: true }) reactionStartDate: string;
  @Column({ name: 'reaction_treatment', nullable: true }) reactionTreatment: string;
  @Column({ name: 'reaction_dose', nullable: true }) reactionDose: string;
  @Column({ name: 'household_contacts_screened', default: 0 }) householdContactsScreened: number;
  @Column({ name: 'outcome', nullable: true }) outcome: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
