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

import {
  BLOG_LOCALES,
  DEFAULT_BLOG_LOCALE,
  isBlogLocale,
  type BlogLocale,
} from './blog-locale';
import {
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
  ): Promise<BlogPostSummaryDto[]> {
    return this.blogService.getPosts(
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
