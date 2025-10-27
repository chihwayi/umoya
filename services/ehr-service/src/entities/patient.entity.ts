import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, BeforeInsert } from 'typeorm';

@Entity('patients')
export class Patient {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_number', unique: true })
  patientNumber: string;

  @Column({ name: 'first_name' })
  firstName: string;

  @Column({ name: 'last_name' })
  lastName: string;

  @Column({ name: 'date_of_birth', type: 'date' })
  dateOfBirth: Date;

  @Column()
  gender: string;

  @Column({ name: 'id_number', unique: true, nullable: true })
  nationalId: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  address: string;

  @Column({ nullable: true })
  city: string;

  @Column({ name: 'emergency_contact_name', nullable: true })
  emergencyContactName: string;

  @Column({ name: 'emergency_contact_phone', nullable: true })
  emergencyContactPhone: string;

  @Column({ name: 'medical_aid_name', nullable: true })
  medicalAidProvider: string;

  @Column({ name: 'medical_aid_number', nullable: true })
  medicalAidNumber: string;

  @Column({ name: 'blood_type', nullable: true })
  bloodType: string;

  @Column({ type: 'text', nullable: true })
  allergies: string;

  @Column({ name: 'chronic_conditions', type: 'text', nullable: true })
  medicalHistory: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @BeforeInsert()
  generatePatientNumber() {
    if (!this.patientNumber) {
      const timestamp = Date.now().toString().slice(-6);
      const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      this.patientNumber = `MED${timestamp}${random}`;
    }
  }

  get fullName(): string {
    return `${this.firstName} ${this.lastName}`;
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

  get mrn(): string {
    return this.patientNumber;
  }
}