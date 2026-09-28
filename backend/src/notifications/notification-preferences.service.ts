import type {
  NotificationLocale,
  NotificationPreferenceGroup,
  NotificationPreferences,
  UpdateNotificationPreferences,
} from '@shared/notifications/notifications';

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type {
  FindOptionsWhere,
  Repository,
} from 'typeorm';

import { NotificationPreferenceEntry } from './entities/notification-preference.entry';

export interface NotificationRecipient {
  userUuid: string;
  locale: NotificationLocale;
}

const DEFAULT_PREFERENCES:
  NotificationPreferences = {
    streams: false,
    music: false,
    blog: false,
    personal: false,
    locale: 'de',
  };

@Injectable()
export class NotificationPreferencesService {
  constructor(
    @InjectRepository(
      NotificationPreferenceEntry,
    )
    private readonly repository:
      Repository<NotificationPreferenceEntry>,
  ) {}

  async get(
    userUuid: string,
  ): Promise<NotificationPreferences> {
    const entry =
      await this.repository.findOneBy({
        userUuid,
      });

    return entry
      ? this.toPreferences(entry)
      : { ...DEFAULT_PREFERENCES };
  }

  async update(
    userUuid: string,
    preferences:
      UpdateNotificationPreferences,
  ): Promise<NotificationPreferences> {
    const existing =
      await this.repository.findOneBy({
        userUuid,
      });

    const entry =
      existing ??
      this.repository.create({
        userUuid,
      });

    entry.streams =
      preferences.streams;
    entry.music =
      preferences.music;
    entry.blog =
      preferences.blog;
    entry.personal =
      preferences.personal;
    entry.locale =
      preferences.locale;

    return this.toPreferences(
      await this.repository.save(
        entry,
      ),
    );
  }

  async getRecipient(
    userUuid: string,
    group: NotificationPreferenceGroup,
  ): Promise<NotificationRecipient | null> {
    const preferences =
      await this.get(userUuid);

    if (!preferences[group]) {
      return null;
    }

    return {
      userUuid,
      locale: preferences.locale,
    };
  }

  async listRecipients(
    group: NotificationPreferenceGroup,
  ): Promise<NotificationRecipient[]> {
    const entries =
      await this.repository.find({
        where:
          this.whereForGroup(group),
        select: {
          userUuid: true,
          locale: true,
        },
      });

    return entries.map(
      (entry) => ({
        userUuid: entry.userUuid,
        locale: entry.locale,
      }),
    );
  }

  private whereForGroup(
    group: NotificationPreferenceGroup,
  ): FindOptionsWhere<NotificationPreferenceEntry> {
    switch (group) {
      case 'streams':
        return {
          streams: true,
        };
      case 'music':
        return {
          music: true,
        };
      case 'blog':
        return {
          blog: true,
        };
      case 'personal':
        return {
          personal: true,
        };
    }
  }

  private toPreferences(
    entry: NotificationPreferenceEntry,
  ): NotificationPreferences {
    return {
      streams: entry.streams,
      music: entry.music,
      blog: entry.blog,
      personal: entry.personal,
      locale: entry.locale,
    };
  }
}
