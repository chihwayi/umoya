import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity({ name: 'user_language_preferences' })
export class UserLanguagePreference {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid', unique: true })
  userId: string;

  @Column({ name: 'preferred_language', default: 'en' })
  preferredLanguage: string;

  @Column({ name: 'secondary_language', nullable: true })
  secondaryLanguage: string;

  @Column({ name: 'clinical_note_language', default: 'en' })
  clinicalNoteLanguage: string;

  @Column({ name: 'ui_language', default: 'en' })
  uiLanguage: string;

  @Column({ name: 'last_updated_at', type: 'timestamptz', default: () => 'NOW()' })
  lastUpdatedAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
