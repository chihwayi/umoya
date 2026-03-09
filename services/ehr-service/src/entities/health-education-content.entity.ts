import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

@Entity('health_education_content')
export class HealthEducationContent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 500 })
  title: string;

  @Index()
  @Column({ length: 100, nullable: true })
  category: string | null;

  @Column({ name: 'content_type', length: 30, default: 'article' })
  contentType: string;

  @Column({ type: 'text' })
  body: string;

  @Index()
  @Column({ length: 10, default: 'en' })
  language: string;

  @Column({ type: 'jsonb', default: () => `'[]'::jsonb` })
  tags: any[];

  @Column({ name: 'is_published', default: true })
  isPublished: boolean;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

