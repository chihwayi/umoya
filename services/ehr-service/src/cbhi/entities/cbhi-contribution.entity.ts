import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'cbhi_contributions' })
export class CbhiContribution {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'household_id', type: 'uuid' }) householdId: string;

  @Column({ name: 'payment_date', type: 'date' }) paymentDate: string;

  @Column({ name: 'period_covered_from', type: 'date' }) periodCoveredFrom: string;

  @Column({ name: 'period_covered_to', type: 'date' }) periodCoveredTo: string;

  @Column({ name: 'amount_paid', type: 'numeric', precision: 10, scale: 2 }) amountPaid: number;

  @Column({ name: 'currency', default: 'USD' }) currency: string;

  @Column({ name: 'subsidy_amount', type: 'numeric', precision: 10, scale: 2, default: 0 }) subsidyAmount: number;

  @Column({ name: 'member_contribution', type: 'numeric', precision: 10, scale: 2 }) memberContribution: number;

  @Column({ name: 'payment_method' }) paymentMethod: string;

  @Column({ name: 'mobile_money_ref', nullable: true }) mobileMoneyRef: string | null;

  @Column({ name: 'receipt_number', nullable: true }) receiptNumber: string | null;

  @Column({ name: 'payment_status', default: 'confirmed' }) paymentStatus: string;

  @Column({ name: 'collected_by', type: 'uuid', nullable: true }) collectedBy: string | null;

  @Column({ name: 'notes', type: 'text', nullable: true }) notes: string | null;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
