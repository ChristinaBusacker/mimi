import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AssetsModule } from '../assets/assets.module';
import { AuthModule } from '../auth/auth.module';
import { ContentModule } from '../content/content.module';
import { UsersModule } from '../users/users.module';
import { BlogAdminAuthorsController } from './blog-admin-authors.controller';
import { BlogAdminPostsController } from './blog-admin-posts.controller';
import { BlogAdminService } from './blog-admin.service';
import { BlogController } from './blog.controller';
import { BlogService } from './blog.service';
import { BlogAuthorProfileEntry } from './entities/blog-author-profile.entry';
import { BlogPostTranslationEntry } from './entities/blog-post-translation.entry';
import { BlogPostEntry } from './entities/blog-post.entry';
import { BlogContributorGuard } from './guards/blog-contributor.guard';

@Module({
  imports: [
    AssetsModule,
    AuthModule,
    ContentModule,
    UsersModule,
    TypeOrmModule.forFeature([
      BlogAuthorProfileEntry,
      BlogPostEntry,
      BlogPostTranslationEntry,
    ]),
  ],
  controllers: [
    BlogController,
    BlogAdminPostsController,
    BlogAdminAuthorsController,
  ],
  providers: [
    BlogService,
    BlogAdminService,
    BlogContributorGuard,
  ],
  exports: [
    BlogService,
  ],
})
export class BlogModule {}
