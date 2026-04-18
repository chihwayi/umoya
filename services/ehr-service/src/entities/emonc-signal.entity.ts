import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('emonc_signals')
export class EmoncSignal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'facility_id', type: 'uuid', nullable: true })
  facilityId: string | null;

  @Column({ name: 'recorded_by', type: 'uuid' })
  recordedBy: string;

  @Column({ name: 'assessment_date', type: 'date' })
  assessmentDate: string;

  @Column({ name: 'assessment_period_months', type: 'int', default: 3 })
  assessmentPeriodMonths: number;

  @Column({ name: 'sf1_parenteral_antibiotics', type: 'text', default: 'unknown' })
  sf1ParenteralAntibiotics: string;

  @Column({ name: 'sf2_parenteral_oxytocics', type: 'text', default: 'unknown' })
  sf2ParenteralOxytocics: string;

  @Column({ name: 'sf3_parenteral_anticonvulsants', type: 'text', default: 'unknown' })
  sf3ParenteralAnticonvulsants: string;

  @Column({ name: 'sf4_manual_removal_placenta', type: 'text', default: 'unknown' })
  sf4ManualRemovalPlacenta: string;

  @Column({ name: 'sf5_removal_retained_products', type: 'text', default: 'unknown' })
  sf5RemovalRetainedProducts: string;

  @Column({ name: 'sf6_neonatal_resuscitation', type: 'text', default: 'unknown' })
  sf6NeonatalResuscitation: string;

  @Column({ name: 'sf7_assisted_vaginal_delivery', type: 'text', default: 'unknown' })
  sf7AssistedVaginalDelivery: string;

  @Column({ name: 'sf8_caesarean_section', type: 'text', default: 'unknown' })
  sf8CaesareanSection: string;

  @Column({ name: 'sf9_blood_transfusion', type: 'text', default: 'unknown' })
  sf9BloodTransfusion: string;

  @Column({ name: 'emonc_classification', type: 'text', nullable: true })
  emoncClassification: string | null;

  @Column({ type: 'jsonb', default: {} })
  barriers: Record<string, any>;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
