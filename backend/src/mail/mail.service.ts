import {
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { MailDeliveryEntry } from './entities/mail-delivery.entry';
import { MailTemplateService } from './mail-template.service';
import { MailTransportService } from './mail-transport.service';
import type {
  MailDeliveryResult,
  SendMailInput,
} from './mail.types';

@Injectable()
export class MailService {
  private readonly logger =
    new Logger(MailService.name);

  constructor(
    @InjectRepository(MailDeliveryEntry)
    private readonly deliveryRepository:
      Repository<MailDeliveryEntry>,
    private readonly templates:
      MailTemplateService,
    private readonly transport:
      MailTransportService,
  ) {}

  async send(
    input: SendMailInput,
  ): Promise<MailDeliveryResult> {
    this.assertInput(input);

    const delivery =
      await this.deliveryRepository.save(
        this.deliveryRepository.create({
          type: input.type,
          recipient: input.to.trim(),
          subject: input.subject.trim(),
          status: 'pending',
          userUuid:
            input.userUuid ?? null,
          context: input.context
            ? { ...input.context }
            : null,
          providerMessageId: null,
          errorMessage: null,
          attempts: 1,
          sentAt: null,
          failedAt: null,
        }),
      );

    let providerMessageId:
      string | null;

    try {
      const rendered =
        await this.templates.render({
          hello: input.hello,
          content: input.content,
          cta: input.cta,
        });

      providerMessageId =
        await this.transport.send({
          to: delivery.recipient,
          subject: delivery.subject,
          html: rendered.html,
          text: rendered.text,
        });
    } catch (error: unknown) {
      await this.markFailed(
        delivery.uuid,
        error,
      );

      throw error;
    }

    const sentAt = new Date();

    try {
      await this.deliveryRepository.update(
        delivery.uuid,
        {
          status: 'sent',
          providerMessageId,
          sentAt,
          failedAt: null,
          errorMessage: null,
        },
      );
    } catch (error: unknown) {
      this.logger.error(
        `Mail ${delivery.uuid} was accepted by SMTP, but its delivery status could not be persisted: ${this.getErrorMessage(error)}`,
      );
    }

    return {
      id: delivery.uuid,
      status: 'sent',
      providerMessageId,
    };
  }

  private async markFailed(
    deliveryUuid: string,
    error: unknown,
  ): Promise<void> {
    try {
      await this.deliveryRepository.update(
        deliveryUuid,
        {
          status: 'failed',
          errorMessage:
            this.getErrorMessage(
              error,
            ),
          failedAt: new Date(),
        },
      );
    } catch (statusError: unknown) {
      this.logger.error(
        `Mail ${deliveryUuid} failed and its failure status could not be persisted: ${this.getErrorMessage(statusError)}`,
      );
    }
  }

  private assertInput(
    input: SendMailInput,
  ): void {
    const recipient =
      input.to.trim();
    const subject =
      input.subject.trim();

    if (!recipient) {
      throw new Error(
        'Mail recipient must not be empty.',
      );
    }

    if (/\r|\n/.test(recipient)) {
      throw new Error(
        'Mail recipient must not contain line breaks.',
      );
    }

    if (recipient.length > 320) {
      throw new Error(
        'Mail recipient must not exceed 320 characters.',
      );
    }

    if (!subject) {
      throw new Error(
        'Mail subject must not be empty.',
      );
    }

    if (/\r|\n/.test(subject)) {
      throw new Error(
        'Mail subject must not contain line breaks.',
      );
    }

    if (subject.length > 255) {
      throw new Error(
        'Mail subject must not exceed 255 characters.',
      );
    }
  }

  private getErrorMessage(
    error: unknown,
  ): string {
    return error instanceof Error
      ? error.message
      : String(error);
  }
}
