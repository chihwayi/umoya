import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { AdminUser } from './admin-user.entity';

export enum AuditAction {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LOGIN = 'login',
  LOGOUT = 'logout',
  PASSWORD_CHANGE = 'password_change',
  TENANT_ACTIVATE = 'tenant_activate',
  TENANT_SUSPEND = 'tenant_suspend',
  USER_CREATE = 'user_create',
  USER_DELETE = 'user_delete'
}

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => AdminUser)
  @JoinColumn({ name: 'userId' })
  user: AdminUser;

  @Column({
    type: 'enum',
    enum: AuditAction
  })
  action: AuditAction;

  @Column()
  resource: string;

  @Column({ nullable: true })
  resourceId: string;

  @Column('jsonb', { nullable: true })
  oldValues: any;

  @Column('jsonb', { nullable: true })
  newValues: any;

  @Column({ nullable: true })
  ipAddress: string;

  @Column({ nullable: true })
  userAgent: string;

  @CreateDateColumn()
  createdAt: Date;
}