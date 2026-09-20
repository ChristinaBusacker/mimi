import { Module } from '@nestjs/common';

import { MarkdownRendererService } from './markdown-renderer.service';

@Module({
  providers: [MarkdownRendererService],
  exports: [MarkdownRendererService],
})
export class ContentModule {}
