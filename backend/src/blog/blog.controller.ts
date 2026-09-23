import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

import { BlogCategoryService } from './blog-category.service';
import {
  BLOG_LOCALES,
  DEFAULT_BLOG_LOCALE,
  isBlogLocale,
  type BlogLocale,
} from './blog-locale';
import {
  BlogAuthorDto,
  BlogAuthorPageDto,
  BlogCategoryDto,
  BlogPostDto,
  BlogPostSummaryDto,
} from './dto/blog-response.dto';
import { BlogService } from './blog.service';

@ApiTags('Blog')
@Controller('blog')
export class BlogController {
  constructor(
    private readonly blogService:
      BlogService,
    private readonly categories:
      BlogCategoryService,
  ) {}

  @Get('posts')
  @ApiOperation({
    summary:
      'List published blog posts',
  })
  @ApiQuery({
    name: 'locale',
    required: false,
    enum: [...BLOG_LOCALES],
  })
  @ApiQuery({
    name: 'author',
    required: false,
  })
  @ApiQuery({
    name: 'category',
    required: false,
  })
  @ApiOkResponse({
    type: BlogPostSummaryDto,
    isArray: true,
  })
  @ApiBadRequestResponse({
    description:
      'The requested locale is not supported.',
  })
  getPosts(
    @Query('locale')
    locale?: string,
    @Query('author')
    author?: string,
    @Query('category')
    category?: string,
  ): Promise<BlogPostSummaryDto[]> {
    return this.blogService.getPosts(
      this.resolveLocale(locale),
      {
        authorSlug:
          author,
        categorySlug:
          category,
      },
    );
  }

  @Get('authors')
  @ApiOperation({
    summary:
      'List public blog authors',
  })
  @ApiOkResponse({
    type: BlogAuthorDto,
    isArray: true,
  })
  getAuthors():
    Promise<BlogAuthorDto[]> {
    return this.blogService
      .getAuthors();
  }

  @Get('authors/:slug')
  @ApiOperation({
    summary:
      'Get a public author page',
  })
  @ApiOkResponse({
    type: BlogAuthorPageDto,
  })
  @ApiNotFoundResponse({
    description:
      'The author does not exist.',
  })
  getAuthor(
    @Param('slug')
    slug: string,
    @Query('locale')
    locale?: string,
  ): Promise<BlogAuthorPageDto> {
    return this.blogService
      .getAuthorPage(
        slug,
        this.resolveLocale(locale),
      );
  }

  @Get('categories')
  @ApiOperation({
    summary:
      'List public blog categories',
  })
  @ApiOkResponse({
    type: BlogCategoryDto,
    isArray: true,
  })
  getCategories(
    @Query('locale')
    locale?: string,
  ): Promise<BlogCategoryDto[]> {
    return this.categories
      .getPublicCategories(
        this.resolveLocale(locale),
      );
  }

  @Get('posts/:slug')
  @ApiOperation({
    summary:
      'Get one published blog post',
  })
  @ApiParam({
    name: 'slug',
  })
  @ApiQuery({
    name: 'locale',
    required: false,
    enum: [...BLOG_LOCALES],
  })
  @ApiOkResponse({
    type: BlogPostDto,
  })
  @ApiBadRequestResponse({
    description:
      'The requested locale is not supported.',
  })
  @ApiNotFoundResponse({
    description:
      'The blog post does not exist or is not published.',
  })
  getPost(
    @Param('slug')
    slug: string,
    @Query('locale')
    locale?: string,
  ): Promise<BlogPostDto> {
    return this.blogService.getPostBySlug(
      slug,
      this.resolveLocale(locale),
    );
  }

  private resolveLocale(
    locale: string | undefined,
  ): BlogLocale {
    if (locale === undefined) {
      return DEFAULT_BLOG_LOCALE;
    }

    if (!isBlogLocale(locale)) {
      throw new BadRequestException(
        `Unsupported locale "${locale}".`,
      );
    }

    return locale;
  }
}
