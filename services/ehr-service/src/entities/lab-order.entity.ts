import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Patient } from './patient.entity';
import { User } from './user.entity';
import { MedicalRecord } from './medical-record.entity';

export enum LabOrderStatus {
  AWAITING_PAYMENT = 'awaiting_payment',
  ORDERED = 'ordered',
  COLLECTED = 'collected',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

export type LabOrderPaymentStatus =
  | 'awaiting_payment'
  | 'payment_confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export enum LabTestCategory {
  HEMATOLOGY = 'hematology',
  CHEMISTRY = 'chemistry',
  MICROBIOLOGY = 'microbiology',
  IMMUNOLOGY = 'immunology',
  PATHOLOGY = 'pathology',
  RADIOLOGY = 'radiology',
  CARDIOLOGY = 'cardiology'
}

export enum Priority {
  ROUTINE = 'routine',
  URGENT = 'urgent',
  STAT = 'stat'
}

@Entity('lab_orders')
export class LabOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'order_number' })
  orderNumber: string;

  @Column({ name: 'patient_id' })
  patientId: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ name: 'ordering_provider_id' })
  orderingProviderId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'ordering_provider_id' })
  orderingProvider: User;

  @Column({ name: 'medical_record_id', nullable: true })
  medicalRecordId: string;

  @ManyToOne(() => MedicalRecord)
  @JoinColumn({ name: 'medical_record_id' })
  medicalRecord: MedicalRecord;

  @Column({ type: 'jsonb', name: 'tests' })
  tests: Array<{
    testCode: string;
    testName: string;
    category: LabTestCategory;
    specimenType: string;
    instructions?: string;
  }>;

  @Column({ type: 'varchar', name: 'priority', default: Priority.ROUTINE })
  priority: Priority;

  @Column({ type: 'varchar', name: 'status', default: LabOrderStatus.ORDERED })
  status: LabOrderStatus;

  @Column({ type: 'text', name: 'clinical_info', nullable: true })
  clinicalInfo: string;

  @Column({ type: 'text', name: 'special_instructions', nullable: true })
  specialInstructions: string;

  @Column({ name: 'snomed_concept_id', nullable: true })
  snomedConceptId?: string;

  @Column({ name: 'snomed_term', type: 'text', nullable: true })
  snomedTerm?: string;

  @Column({ name: 'snomed_module_id', nullable: true })
  snomedModuleId?: string;

  @Column({ name: 'snomed_definition_status', nullable: true })
  snomedDefinitionStatus?: string;

  @Column({ name: 'loinc_code', nullable: true })
  loincCode?: string;

  @Column({ name: 'loinc_long_name', type: 'text', nullable: true })
  loincLongName?: string;

  @Column({ name: 'cpt_code', nullable: true })
  cptCode?: string;

  @Column({ type: 'timestamp', name: 'scheduled_date_time', nullable: true })
  scheduledDateTime: Date;

  @Column({ type: 'timestamp', name: 'collected_at', nullable: true })
  collectedAt: Date;

  @Column({ name: 'collected_by_id', nullable: true })
  collectedById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'collected_by_id' })
  collectedBy: User;

  @Column({ type: 'jsonb', name: 'results', nullable: true })
  results: Array<{
    testCode: string;
    testName: string;
    value: string;
    unit: string;
    referenceRange: string;
    flag: 'normal' | 'high' | 'low' | 'critical';
    resultDate: Date;
    performedBy: string;
  }>;

  @Column({ type: 'text', name: 'interpretation', nullable: true })
  interpretation: string;

  @Column({ name: 'reviewed_by_id', nullable: true })
  reviewedById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'reviewed_by_id' })
  reviewedBy: User;

  @Column({ type: 'timestamp', name: 'reviewed_at', nullable: true })
  reviewedAt: Date;

  @Column({ type: 'jsonb', name: 'attachments', nullable: true })
  attachments: Array<{
    filename: string;
    url: string;
    type: string;
    uploadedAt: Date;
  }>;

  @Column({
    type: 'jsonb',
    name: 'processing_context',
    nullable: true,
    default: () => `'{}'::jsonb`,
  })
  processingContext: Record<string, any>;

  @Column({
    type: 'jsonb',
    name: 'workflow_events',
    nullable: true,
    default: () => `'[]'::jsonb`,
  })
  workflowEvents: Array<Record<string, any>>;

  @Column({
    type: 'jsonb',
    name: 'handoff_notes',
    nullable: true,
    default: () => `'[]'::jsonb`,
  })
  handoffNotes: Array<Record<string, any>>;

  @Column({
    type: 'jsonb',
    name: 'notification_log',
    nullable: true,
    default: () => `'[]'::jsonb`,
  })
  notificationLog: Array<Record<string, any>>;

  @Column({ name: 'fee_amount', type: 'numeric', precision: 12, scale: 2, nullable: true })
  feeAmount: number | null;

  @Column({ name: 'finance_transaction_id', nullable: true })
  financeTransactionId: string | null;

  @Column({ name: 'payment_status', type: 'varchar', default: 'payment_confirmed' })
  paymentStatus: LabOrderPaymentStatus;
  @Column({ name: 'clinical_indication', type: 'text', nullable: true })
  clinicalIndication?: string;

  @Column({ name: 'icd10_codes', type: 'text', array: true, nullable: true })
  icd10Codes?: string[];

  @Column({ name: 'order_set_id', type: 'uuid', nullable: true })
  orderSetId?: string;

  @Column({ name: 'ordering_provider', type: 'uuid', nullable: true })
  orderingProviderValue?: string;

  @Column({ name: 'result_acknowledged', type: 'boolean', nullable: true, default: false })
  resultAcknowledged: boolean = false;

  @Column({ name: 'result_acknowledged_at', type: 'timestamptz', nullable: true })
  resultAcknowledgedAt?: Date;

  @Column({ name: 'result_acknowledged_by', type: 'uuid', nullable: true })
  resultAcknowledgedBy?: string;

  @Column({ name: 'result_reported_at', type: 'timestamptz', nullable: true })
  resultReportedAt?: Date;

  @Column({ name: 'specimen_collected_at', type: 'timestamptz', nullable: true })
  specimenCollectedAt?: Date;

  @Column({ name: 'specimen_received_at', type: 'timestamptz', nullable: true })
  specimenReceivedAt?: Date;

  @Column({ name: 'test_catalog_id', type: 'uuid', nullable: true })
  testCatalogId?: string;


  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}