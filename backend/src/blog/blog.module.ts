import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AssetsModule } from '../assets/assets.module';
import { AuthModule } from '../auth/auth.module';
import { ContentModule } from '../content/content.module';
import { UsersModule } from '../users/users.module';
import { BlogAdminAuthorsController } from './blog-admin-authors.controller';
import { BlogAdminPostsController } from './blog-admin-posts.controller';
import { BlogAdminService } from './blog-admin.service';
import { BlogAuthorDirectoryController } from './blog-author-directory.controller';
import { BlogAuthorDirectoryService } from './blog-author-directory.service';
import { BlogCategoryController } from './blog-category.controller';
import { BlogCategoryService } from './blog-category.service';
import { BlogController } from './blog.controller';
import { BlogService } from './blog.service';
import { BlogAuthorProfileEntry } from './entities/blog-author-profile.entry';
import { BlogCategoryTranslationEntry } from './entities/blog-category-translation.entry';
import { BlogCategoryEntry } from './entities/blog-category.entry';
import { BlogPostTranslationEntry } from './entities/blog-post-translation.entry';
import { BlogPostEntry } from './entities/blog-post.entry';
import { BlogContributorGuard } from './guards/blog-contributor.guard';
import { UserManagementController } from './user-management.controller';
import { UserManagementService } from './user-management.service';

@Module({
  imports: [
    AssetsModule,
    AuthModule,
    ContentModule,
    UsersModule,
    TypeOrmModule.forFeature([
      BlogAuthorProfileEntry,
      BlogCategoryEntry,
      BlogCategoryTranslationEntry,
      BlogPostEntry,
      BlogPostTranslationEntry,
    ]),
  ],
  controllers: [
    BlogController,
    BlogAuthorDirectoryController,
    BlogAdminPostsController,
    BlogAdminAuthorsController,
    BlogCategoryController,
    UserManagementController,
  ],
  providers: [
    BlogService,
    BlogAuthorDirectoryService,
    BlogCategoryService,
    BlogAdminService,
    BlogContributorGuard,
    UserManagementService,
  ],
  exports: [
    BlogService,
  ],
})
export class BlogModule {}
