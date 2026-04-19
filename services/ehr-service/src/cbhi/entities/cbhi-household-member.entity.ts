import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'cbhi_household_members' })
export class CbhiHouseholdMember {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'household_id', type: 'uuid' }) householdId: string;

  @Column({ name: 'patient_id', type: 'uuid', unique: true }) patientId: string;

  @Column({ name: 'member_number', nullable: true }) memberNumber: string | null;

  @Column({ name: 'relationship_to_head' }) relationshipToHead: string;

  @Column({ name: 'member_status', default: 'active' }) memberStatus: string;

  @Column({ name: 'joined_date', type: 'date' }) joinedDate: string;

  @Column({ name: 'left_date', type: 'date', nullable: true }) leftDate: string | null;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
