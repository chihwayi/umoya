import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('outcome_follow_up_schedules')
export class OutcomeFollowUpSchedule {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() tenantId: string;
  @Column('uuid') encounterId: string;
  @Column() encounterType: string;
  @Column('uuid') patientId: string;
  @Column('date') dueDate: string;
  @Column('int') windowDays: number;
  @Column({ default: 'pending' }) status: string;
  @Column({ type: 'uuid', nullable: true }) assignedTo: string;
  @Column({ type: 'timestamptz', nullable: true }) completedAt: Date;
  @Column({ type: 'uuid', nullable: true }) outcomeId: string;
  @CreateDateColumn() createdAt: Date;
}
