import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import type { MusicLocale } from '../music-locale';
import { MusicTrackEntry } from './music-track.entry';

@Index(['trackUuid', 'locale'], {
  unique: true,
})
@Entity('music_track_translations')
export class MusicTrackTranslationEntry {
  @PrimaryGeneratedColumn('uuid')
  uuid!: string;

  @Column({
    type: 'uuid',
  })
  trackUuid!: string;

  @ManyToOne(() => MusicTrackEntry, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'trackUuid',
  })
  track!: MusicTrackEntry;

  @Column({
    type: 'varchar',
    length: 5,
  })
  locale!: MusicLocale;

  @Column({
    length: 255,
  })
  title!: string;

  @Column({
    type: 'text',
    default: '',
  })
  contentMarkdown!: string;
}
