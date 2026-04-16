import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('scheme_tariff_schedules')
export class SchemeTariffSchedule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'scheme_code', type: 'text' })
  schemeCode: string;

  @Column({ name: 'service_code', type: 'text' })
  serviceCode: string;

  @Column({ name: 'service_description', type: 'text' })
  serviceDescription: string;

  @Column({ name: 'tariff_amount', type: 'numeric', precision: 10, scale: 2 })
  tariffAmount: number;

  @Column({ name: 'currency_code', type: 'varchar', length: 3, default: 'USD' })
  currencyCode: string;

  @Column({ name: 'effective_from', type: 'date', nullable: true })
  effectiveFrom: string | null;

  @Column({ name: 'effective_to', type: 'date', nullable: true })
  effectiveTo: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
