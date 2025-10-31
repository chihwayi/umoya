import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('lab_order_sets')
export class LabOrderSet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'set_name' })
  setName: string;

  @Column({ name: 'set_code', unique: true })
  setCode: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'test_ids', type: 'jsonb' })
  testIds: string[];

  @Column({ nullable: true })
  category: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

