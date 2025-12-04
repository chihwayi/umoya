import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('operating_rooms')
export class OperatingRoom {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'room_number', length: 20, unique: true })
  roomNumber: string;

  @Column({ name: 'room_name', length: 100 })
  roomName: string;

  @Column({ length: 100, nullable: true })
  location: string;

  @Column({ name: 'room_type', length: 50 })
  roomType: string;

  @Column({ length: 20, default: 'available' })
  status: string;

  @Column({ name: 'has_laminar_flow', default: false })
  hasLaminarFlow: boolean;

  @Column({ name: 'has_c_arm', default: false })
  hasCArm: boolean;

  @Column({ name: 'has_microscope', default: false })
  hasMicroscope: boolean;

  @Column({ name: 'has_robot', default: false })
  hasRobot: boolean;

  @Column({ name: 'equipment_list', type: 'jsonb', default: '[]' })
  equipmentList: any[];

  @Column({ default: 1 })
  capacity: number;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

