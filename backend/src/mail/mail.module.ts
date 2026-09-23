import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { MailDeliveryEntry } from './entities/mail-delivery.entry';
import { MailService } from './mail.service';
import { MailTemplateService } from './mail-template.service';
import { MailTransportService } from './mail-transport.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MailDeliveryEntry,
    ]),
  ],
  providers: [
    MailService,
    MailTemplateService,
    MailTransportService,
  ],
  exports: [
    MailService,
  ],
})
export class MailModule {}
