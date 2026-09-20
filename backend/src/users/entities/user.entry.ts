import type { UserRole } from '@shared/auth/authenticated-user';

import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('users')
export class UserEntry {
  @PrimaryGeneratedColumn('uuid')
  uuid!: string;

  @Column()
  name!: string;

  @Column({
    unique: true,
  })
  email!: string;

  @Column({
    type: 'varchar',
    nullable: true,
    select: false,
  })
  password!: string | null;

  @Column({
    type: 'varchar',
    nullable: true,
    unique: true,
  })
  discordId!: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'user',
  })
  role!: UserRole;
}
