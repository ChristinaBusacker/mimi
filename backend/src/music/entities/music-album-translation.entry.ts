import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import type { MusicLocale } from '../music-locale';
import { MusicAlbumEntry } from './music-album.entry';

@Index(['albumUuid', 'locale'], {
  unique: true,
})
@Entity('music_album_translations')
export class MusicAlbumTranslationEntry {
  @PrimaryGeneratedColumn('uuid')
  uuid!: string;

  @Column({
    type: 'uuid',
  })
  albumUuid!: string;

  @ManyToOne(() => MusicAlbumEntry, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'albumUuid',
  })
  album!: MusicAlbumEntry;

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
