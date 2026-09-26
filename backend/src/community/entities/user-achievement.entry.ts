import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

@Entity('user_achievements')
@Index(
  'IDX_user_achievements_achievement',
  ['achievementUuid'],
)
export class UserAchievementEntry {
  @PrimaryColumn({
    type: 'uuid',
  })
  userUuid!: string;

  @PrimaryColumn({
    type: 'uuid',
  })
  achievementUuid!: string;

  @Column({
    type: 'uuid',
    nullable: true,
  })
  triggerEventUuid!: string | null;

  @CreateDateColumn({
    type: 'timestamptz',
  })
  unlockedAt!: Date;
}
