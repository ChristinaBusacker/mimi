import type {
  UserRole,
} from '@shared/auth/authenticated-user';
import type {
  BlogAdminAuthor,
} from '@shared/blog/blog-admin';

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { UsersService } from '../users/users.service';
import { BlogAuthorProfileEntry } from './entities/blog-author-profile.entry';

@Injectable()
export class BlogAuthorDirectoryService {
  constructor(
    private readonly usersService:
      UsersService,
    @InjectRepository(BlogAuthorProfileEntry)
    private readonly authorRepository:
      Repository<BlogAuthorProfileEntry>,
  ) {}

  async getAuthors():
    Promise<BlogAdminAuthor[]> {
    const [
      users,
      profiles,
    ] = await Promise.all([
      this.usersService.findAll(),
      this.authorRepository.find({
        order: {
          displayName: 'ASC',
        },
      }),
    ]);
    const roles = new Map<
      string,
      UserRole
    >(
      users.map((user) => [
        user.uuid,
        user.role,
      ]),
    );

    return profiles
      .map((profile) => {
        const role =
          roles.get(
            profile.userUuid,
          );

        return role === 'author' ||
          role === 'editor' ||
          role === 'admin'
          ? {
              userId:
                profile.userUuid,
              slug: profile.slug,
              displayName:
                profile.displayName,
              bio: profile.bio,
              avatarAssetId:
                profile.avatarAssetId,
              role,
              createdAt:
                profile.createdAt
                  .toISOString(),
              updatedAt:
                profile.updatedAt
                  .toISOString(),
            }
          : null;
      })
      .filter(
        (
          author,
        ): author is BlogAdminAuthor =>
          author !== null,
      );
  }
}
