import {
  Column,
  Entity,
  PrimaryColumn,
} from 'typeorm';

@Entity(
  'community_profile_pinned_achievements',
)
export class CommunityPinnedAchievementEntry {
  @PrimaryColumn({
    type: 'uuid',
  })
  userUuid!: string;

  @PrimaryColumn({
    type: 'uuid',
  })
  achievementUuid!: string;

  @Column({
    type: 'smallint',
  })
  position!: number;
}
