import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';

import { ContactService } from './contact.service';
import { ContactMessageDto } from './dto/contact-message.dto';

@Controller('contact')
export class ContactController {
  constructor(
    private readonly contactService: ContactService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  async submit(
    @Body() dto: ContactMessageDto,
  ): Promise<void> {
    await this.contactService.submit(dto);
  }
}
