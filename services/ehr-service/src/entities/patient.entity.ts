import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';

export enum Gender {
  MALE = 'male',
  FEMALE = 'female',
  OTHER = 'other'
}

export enum BloodType {
  A_POSITIVE = 'A+',
  A_NEGATIVE = 'A-',
  B_POSITIVE = 'B+',
  B_NEGATIVE = 'B-',
  AB_POSITIVE = 'AB+',
  AB_NEGATIVE = 'AB-',
  O_POSITIVE = 'O+',
  O_NEGATIVE = 'O-'
}

export enum MaritalStatus {
  SINGLE = 'single',
  MARRIED = 'married',
  DIVORCED = 'divorced',
  WIDOWED = 'widowed'
}

@Entity('patients')
export class Patient {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  patientNumber: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({ nullable: true })
  middleName: string;

  @Column({ type: 'date' })
  dateOfBirth: Date;

  @Column({ type: 'enum', enum: Gender })
  gender: Gender;

  @Column({ nullable: true })
  nationalId: string;

  @Column({ nullable: true })
  passportNumber: string;

  @Column()
  phone: string;

  @Column({ nullable: true })
  email: string;

  @Column({ type: 'text' })
  address: string;

  @Column({ nullable: true })
  city: string;

  @Column({ nullable: true })
  province: string;

  @Column({ nullable: true })
  postalCode: string;

  @Column({ type: 'enum', enum: MaritalStatus, nullable: true })
  maritalStatus: MaritalStatus;

  @Column({ nullable: true })
  occupation: string;

  @Column({ nullable: true })
  employer: string;

  @Column({ type: 'enum', enum: BloodType, nullable: true })
  bloodType: BloodType;

  @Column({ nullable: true })
  emergencyContactName: string;

  @Column({ nullable: true })
  emergencyContactPhone: string;

  @Column({ nullable: true })
  emergencyContactRelation: string;

  @Column({ type: 'text', nullable: true })
  allergies: string;

  @Column({ type: 'text', nullable: true })
  medicalHistory: string;

  @Column({ type: 'text', nullable: true })
  currentMedications: string;

  @Column({ nullable: true })
  insuranceProvider: string;

  @Column({ nullable: true })
  insuranceNumber: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  get fullName(): string {
    return this.middleName 
      ? `${this.firstName} ${this.middleName} ${this.lastName}`
      : `${this.firstName} ${this.lastName}`;
  }

  get age(): number {
    const today = new Date();
    const birthDate = new Date(this.dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  }
}