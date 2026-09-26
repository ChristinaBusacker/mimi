import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

@Entity('user_titles')
@Index(
  'IDX_user_titles_title',
  ['titleUuid'],
)
export class UserTitleEntry {
  @PrimaryColumn({
    type: 'uuid',
  })
  userUuid!: string;

  @PrimaryColumn({
    type: 'uuid',
  })
  titleUuid!: string;

  @Column({
    type: 'uuid',
    nullable: true,
  })
  sourceAchievementUuid!: string | null;

  @CreateDateColumn({
    type: 'timestamptz',
  })
  unlockedAt!: Date;
}
