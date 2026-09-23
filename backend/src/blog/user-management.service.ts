import type {
  AuthenticatedUser,
  UserRole,
} from '@shared/auth/authenticated-user';
import type {
  ManagedUser,
  OwnProfile,
  SaveManagedUser,
  SaveOwnProfile,
} from '@shared/users/user';

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InjectDataSource,
  InjectRepository,
} from '@nestjs/typeorm';
import {
  DataSource,
  Not,
  Repository,
} from 'typeorm';

import { AssetUsageService } from '../assets/asset-usage.service';
import { AssetsService } from '../assets/assets.service';
import { UserEntry } from '../users/entities/user.entry';
import { UsersService } from '../users/users.service';
import { BlogAuthorProfileEntry } from './entities/blog-author-profile.entry';

const CONTRIBUTOR_ROLES:
  readonly UserRole[] = [
    'author',
    'editor',
    'admin',
  ];

@Injectable()
export class UserManagementService {
  constructor(
    private readonly usersService:
      UsersService,
    private readonly assetsService:
      AssetsService,
    private readonly assetUsageService:
      AssetUsageService,
    @InjectDataSource()
    private readonly dataSource:
      DataSource,
    @InjectRepository(BlogAuthorProfileEntry)
    private readonly profileRepository:
      Repository<BlogAuthorProfileEntry>,
  ) {}

  async getUsers():
    Promise<ManagedUser[]> {
    await this.ensureContributorProfiles();

    const [
      users,
      profiles,
    ] = await Promise.all([
      this.usersService.findAll(),
      this.profileRepository.find(),
    ]);
    const profilesByUser =
      new Map(
        profiles.map(
          (profile) => [
            profile.userUuid,
            profile,
          ],
        ),
      );

    return users.map((user) => ({
      id: user.uuid,
      name: user.name,
      email: user.email,
      discordId:
        user.discordId,
      role: user.role,
      profile:
        this.mapManagedProfile(
          profilesByUser.get(
            user.uuid,
          ) ?? null,
        ),
    }));
  }

  async saveUser(
    userUuid: string,
    input: SaveManagedUser,
  ): Promise<ManagedUser> {
    const user =
      await this.usersService.findByUuid(
        userUuid,
      );

    if (!user) {
      throw new NotFoundException(
        `User "${userUuid}" not found.`,
      );
    }

    const currentProfile =
      await this.profileRepository.findOneBy({
        userUuid,
      });

    if (
      this.isContributorRole(
        input.role,
      )
    ) {
      const slug =
        input.slug?.trim() ||
        currentProfile?.slug;
      const displayName =
        input.displayName?.trim() ||
        currentProfile?.displayName;

      if (
        !slug ||
        !displayName
      ) {
        throw new BadRequestException(
          'Contributor accounts require a public name and author slug.',
        );
      }

      await this.assertSlugAvailable(
        slug,
        userUuid,
      );

      await this.dataSource.transaction(
        async (manager) => {
          await manager
            .getRepository(
              UserEntry,
            )
            .save({
              ...user,
              role: input.role,
            });

          const repository =
            manager.getRepository(
              BlogAuthorProfileEntry,
            );

          await repository.save(
            currentProfile
              ? {
                  ...currentProfile,
                  slug,
                  displayName,
                }
              : repository.create({
                  userUuid,
                  slug,
                  displayName,
                  bio: '',
                  avatarAssetId:
                    null,
                }),
          );
        },
      );
    } else {
      await this.usersService.setRole(
        user,
        input.role,
      );
    }

    const updatedUser =
      await this.usersService.findByUuid(
        userUuid,
      );
    const updatedProfile =
      await this.profileRepository.findOneBy({
        userUuid,
      });

    if (!updatedUser) {
      throw new NotFoundException();
    }

    return {
      id: updatedUser.uuid,
      name: updatedUser.name,
      email: updatedUser.email,
      discordId:
        updatedUser.discordId,
      role: updatedUser.role,
      profile:
        this.mapManagedProfile(
          updatedProfile,
        ),
    };
  }

  async getOwnProfile(
    actor: AuthenticatedUser,
  ): Promise<OwnProfile> {
    const user =
      await this.usersService.findByUuid(
        actor.uuid,
      );

    if (!user) {
      throw new NotFoundException();
    }

    const profile =
      await this.ensureProfile(
        user,
      );

    return this.mapOwnProfile(
      profile,
    );
  }

  async saveOwnProfile(
    actor: AuthenticatedUser,
    input: SaveOwnProfile,
  ): Promise<OwnProfile> {
    const user =
      await this.usersService.findByUuid(
        actor.uuid,
      );

    if (!user) {
      throw new NotFoundException();
    }

    const profile =
      await this.ensureProfile(
        user,
      );

    await this.assertImageAsset(
      input.avatarAssetId,
    );

    const markdownAssets =
      this.assetUsageService
        .extractMarkdownAssetIds(
          input.bio,
        );

    for (
      const assetId
      of markdownAssets
    ) {
      await this.assertImageAsset(
        assetId,
      );
    }

    await this.dataSource.transaction(
      async (manager) => {
        await manager
          .getRepository(
            BlogAuthorProfileEntry,
          )
          .save({
            ...profile,
            bio: input.bio,
            avatarAssetId:
              input.avatarAssetId,
          });

        await this.assetUsageService.syncOwner(
          manager,
          'blogAuthor',
          actor.uuid,
          [
            ...(input.avatarAssetId
              ? [
                  {
                    assetUuid:
                      input.avatarAssetId,
                    scope: 'avatar',
                  },
                ]
              : []),
            ...markdownAssets.map(
              (assetUuid) => ({
                assetUuid,
                scope: 'bio',
              }),
            ),
          ],
        );
      },
    );

    return this.mapOwnProfile(
      await this.profileRepository
        .findOneByOrFail({
          userUuid: actor.uuid,
        }),
    );
  }

  async getPublicProfiles():
    Promise<BlogAuthorProfileEntry[]> {
    await this.ensureContributorProfiles();

    const users =
      await this.usersService.findAll();
    const contributorIds =
      new Set(
        users
          .filter((user) =>
            this.isContributorRole(
              user.role,
            ),
          )
          .map(
            (user) => user.uuid,
          ),
      );

    return (
      await this.profileRepository.find({
        order: {
          displayName: 'ASC',
        },
      })
    ).filter((profile) =>
      contributorIds.has(
        profile.userUuid,
      ),
    );
  }

  async findPublicProfileBySlug(
    slug: string,
  ): Promise<BlogAuthorProfileEntry | null> {
    await this.ensureContributorProfiles();

    const profile =
      await this.profileRepository.findOneBy({
        slug,
      });

    if (!profile) {
      return null;
    }

    const user =
      await this.usersService.findByUuid(
        profile.userUuid,
      );

    return user &&
      this.isContributorRole(
        user.role,
      )
      ? profile
      : null;
  }

  private async ensureContributorProfiles():
    Promise<void> {
    const users =
      await this.usersService.findAll();

    for (
      const user
      of users.filter((candidate) =>
        this.isContributorRole(
          candidate.role,
        ),
      )
    ) {
      await this.ensureProfile(
        user,
      );
    }
  }

  private async ensureProfile(
    user: UserEntry,
  ): Promise<BlogAuthorProfileEntry> {
    const existing =
      await this.profileRepository.findOneBy({
        userUuid: user.uuid,
      });

    if (existing) {
      return existing;
    }

    const slug =
      await this.createAvailableSlug(
        user.name,
      );

    return this.profileRepository.save(
      this.profileRepository.create({
        userUuid: user.uuid,
        slug,
        displayName:
          user.name,
        bio: '',
        avatarAssetId: null,
      }),
    );
  }

  private async createAvailableSlug(
    name: string,
  ): Promise<string> {
    const base =
      this.slugify(name) ||
      'autor';
    let slug = base;
    let suffix = 2;

    while (
      await this.profileRepository.exists({
        where: {
          slug,
        },
      })
    ) {
      slug =
        `${base}-${suffix}`;
      suffix += 1;
    }

    return slug;
  }

  private async assertSlugAvailable(
    slug: string,
    userUuid: string,
  ): Promise<void> {
    const existing =
      await this.profileRepository.findOne({
        where: {
          slug,
          userUuid:
            Not(userUuid),
        },
      });

    if (existing) {
      throw new ConflictException(
        `Author slug "${slug}" already exists.`,
      );
    }
  }

  private async assertImageAsset(
    assetId: string | null,
  ): Promise<void> {
    if (!assetId) {
      return;
    }

    const asset =
      await this.assetsService.getById(
        assetId,
      );

    if (
      asset.type !== 'image'
    ) {
      throw new BadRequestException(
        `Asset "${assetId}" must be an image.`,
      );
    }
  }

  private mapManagedProfile(
    profile:
      BlogAuthorProfileEntry | null,
  ): ManagedUser['profile'] {
    return profile
      ? {
          slug: profile.slug,
          displayName:
            profile.displayName,
          bio: profile.bio,
          avatarAssetId:
            profile.avatarAssetId,
        }
      : null;
  }

  private mapOwnProfile(
    profile:
      BlogAuthorProfileEntry,
  ): OwnProfile {
    return {
      userId:
        profile.userUuid,
      slug: profile.slug,
      displayName:
        profile.displayName,
      bio: profile.bio,
      avatarAssetId:
        profile.avatarAssetId,
    };
  }

  private isContributorRole(
    role: UserRole,
  ): boolean {
    return CONTRIBUTOR_ROLES.includes(
      role,
    );
  }

  private slugify(
    value: string,
  ): string {
    return value
      .replace(/ß/g, 'ss')
      .normalize('NFKD')
      .replace(
        /[\u0300-\u036f]/g,
        '',
      )
      .toLowerCase()
      .replace(
        /[^a-z0-9]+/g,
        '-',
      )
      .replace(
        /^-+|-+$/g,
        '',
      )
      .slice(0, 160);
  }
}
