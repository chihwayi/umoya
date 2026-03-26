import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('goals_of_care')
export class GoalsOfCare {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'facilitated_by', type: 'uuid' }) facilitatedBy: string;
  @Column({ name: 'document_date', type: 'timestamptz' }) documentDate: Date;
  @Column({ name: 'primary_goal', type: 'text' }) primaryGoal: string;
  @Column({ name: 'cpr_wishes', type: 'text' }) cprWishes: string;
  @Column({ name: 'ventilation_wishes', type: 'text' }) ventilationWishes: string;
  @Column({ name: 'artificial_nutrition_wishes', type: 'text' }) artificialNutritionWishes: string;
  @Column({ name: 'hospitalisation_wishes', type: 'text' }) hospitalisationWishes: string;
  @Column({ name: 'preferred_place_of_death', type: 'text', nullable: true }) preferredPlaceOfDeath: string;
  @Column({ name: 'discussion_participants', type: 'jsonb', default: '[]' }) discussionParticipants: any;
  @Column({ name: 'patient_has_capacity', type: 'boolean', default: true }) patientHasCapacity: boolean;
  @Column({ name: 'interpreter_used', type: 'boolean', default: false }) interpreterUsed: boolean;
  @Column({ name: 'review_date', type: 'date', nullable: true }) reviewDate: string;
  @Column({ name: 'is_active', type: 'boolean', default: true }) isActive: boolean;  @Column({ name: 'artificial_nutrition_wish', type: 'text', nullable: true })
  artificialNutritionWish?: string;

  @Column({ name: 'cpr_wish', type: 'text', nullable: true })
  cprWish?: string;

  @Column({ name: 'documented_by', type: 'uuid' })
  documentedBy: string;

  @Column({ name: 'hospital_admission_wish', type: 'text', nullable: true })
  hospitalAdmissionWish?: string;

  @Column({ nullable: true })
  notes?: string;

  @Column({ name: 'ventilation_wish', type: 'text', nullable: true })
  ventilationWish?: string;


  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
