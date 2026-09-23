import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';

import type {
  MailTransportMessage,
} from './mail.types';

@Injectable()
export class MailTransportService
  implements OnApplicationBootstrap
{
  private readonly logger =
    new Logger(
      MailTransportService.name,
    );

  private readonly transporter:
    ReturnType<
      typeof nodemailer.createTransport
    > | null;

  private readonly from:
    {
      name: string;
      address: string;
    } | null;

  constructor(
    private readonly configService:
      ConfigService,
  ) {
    if (!this.isEnabled()) {
      this.transporter = null;
      this.from = null;

      return;
    }

    const port = this.getPort();
    const user =
      this.configService.get<string>(
        'MAIL_USER',
      );
    const password =
      this.configService.get<string>(
        'MAIL_PASSWORD',
      );

    if (
      Boolean(user) !==
      Boolean(password)
    ) {
      throw new Error(
        'MAIL_USER and MAIL_PASSWORD must either both be configured or both be omitted.',
      );
    }

    this.transporter =
      nodemailer.createTransport({
        host: this.configService
          .getOrThrow<string>(
            'MAIL_HOST',
          ),
        port,
        secure:
          this.getSecure(port),
        auth:
          user && password
            ? {
                user,
                pass: password,
              }
            : undefined,
      });

    this.from = {
      name:
        this.configService.get<string>(
          'MAIL_FROM_NAME',
        ) ?? 'Mimis Show',
      address:
        this.configService
          .getOrThrow<string>(
            'MAIL_FROM_ADDRESS',
          ),
    };
  }

  async onApplicationBootstrap():
    Promise<void> {
    if (!this.transporter) {
      this.logger.log(
        'Mail delivery is disabled.',
      );

      return;
    }

    try {
      await this.transporter.verify();
      this.logger.log(
        'SMTP transport verified.',
      );
    } catch (error: unknown) {
      this.logger.warn(
        `SMTP transport could not be verified: ${this.getErrorMessage(error)}`,
      );
    }
  }

  async send(
    message: MailTransportMessage,
  ): Promise<string | null> {
    if (
      !this.transporter ||
      !this.from
    ) {
      throw new Error(
        'Mail delivery is disabled. Set MAIL_ENABLED=true and configure SMTP before sending mail.',
      );
    }

    const result =
      await this.transporter.sendMail({
        from: this.from,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
      });

    return typeof result.messageId ===
      'string'
      ? result.messageId
      : null;
  }

  private isEnabled(): boolean {
    return this.configService.get<string>(
      'MAIL_ENABLED',
    ) === 'true';
  }

  private getPort(): number {
    const value =
      this.configService
        .getOrThrow<string>(
          'MAIL_PORT',
        );
    const port = Number(value);

    if (
      !Number.isInteger(port) ||
      port <= 0 ||
      port > 65535
    ) {
      throw new Error(
        `MAIL_PORT "${value}" is invalid.`,
      );
    }

    return port;
  }

  private getSecure(
    port: number,
  ): boolean {
    const configured =
      this.configService.get<string>(
        'MAIL_SECURE',
      );

    if (configured === undefined) {
      return port === 465;
    }

    if (
      configured !== 'true' &&
      configured !== 'false'
    ) {
      throw new Error(
        'MAIL_SECURE must be either "true" or "false".',
      );
    }

    return configured === 'true';
  }

  private getErrorMessage(
    error: unknown,
  ): string {
    return error instanceof Error
      ? error.message
      : String(error);
  }
}
