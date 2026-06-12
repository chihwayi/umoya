import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

/**
 * S225 — server-side idempotency for offline replays.
 *
 * A queued mobile write replays with a stable X-Client-Op-Id header; the first
 * successful execution stores its response here and any retry (after a lost
 * response during load shedding) returns the stored response instead of
 * re-executing the mutation.
 */
@Entity('idempotency_keys')
@Index(['createdAt'])
export class IdempotencyKey {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'op_id', unique: true })
  opId: string;

  @Column({ name: 'method', length: 10 })
  method: string;

  @Column({ name: 'path', type: 'text' })
  path: string;

  @Column({ name: 'response', type: 'jsonb', nullable: true })
  response: any;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;
}
