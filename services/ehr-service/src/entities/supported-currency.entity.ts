import { Entity, Column, PrimaryColumn, CreateDateColumn } from 'typeorm';

@Entity('supported_currencies')
export class SupportedCurrency {
  @PrimaryColumn({ length: 10 })
  code: string;

  @Column({ length: 100 })
  name: string;

  @Column({ length: 10, nullable: true })
  symbol: string | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

