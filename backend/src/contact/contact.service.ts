import type {
  ContactLanguage,
} from '@shared/contact/contact-message';

import {
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';

import { MailService } from '../mail/mail.service';
import { ContactMessageDto } from './dto/contact-message.dto';

const CONTACT_RECIPIENT =
  'kontakt@mimishow.de';

const SUBMISSION_COOLDOWN_MS =
  60_000;

interface ConfirmationCopy {
  subject: string;
  hello: (name: string) => string;
  intro: string;
  subjectLabel: string;
  messageLabel: string;
  outro: string;
}

const CONFIRMATION_COPY:
  Readonly<Record<
    ContactLanguage,
    ConfirmationCopy
  >> = {
    de: {
      subject:
        'Wir haben deine Nachricht erhalten',
      hello: (name) =>
        `Hallo ${name},`,
      intro:
        'vielen Dank für deine Nachricht an Mimi Show. Sie ist bei uns eingegangen.',
      subjectLabel: 'Betreff',
      messageLabel: 'Deine Nachricht',
      outro:
        'Bitte antworte nicht auf diese automatische Bestätigung. Wir melden uns über die von dir angegebene E-Mail-Adresse.',
    },
    en: {
      subject:
        'We received your message',
      hello: (name) =>
        `Hello ${name},`,
      intro:
        'Thank you for your message to Mimi Show. We have received it.',
      subjectLabel: 'Subject',
      messageLabel: 'Your message',
      outro:
        'Please do not reply to this automatic confirmation. We will get back to you using the email address you provided.',
    },
  };

@Injectable()
export class ContactService {
  private readonly lastSubmissionByEmail =
    new Map<string, number>();

  constructor(
    private readonly mailService:
      MailService,
  ) {}

  async submit(
    dto: ContactMessageDto,
  ): Promise<void> {
    if (dto.website?.trim()) {
      return;
    }

    const name = dto.name.trim();
    const email = dto.email.trim();
    const subject = dto.subject.trim();
    const message = dto.message.trim();

    this.assertRateLimit(email);

    const confirmation =
      CONFIRMATION_COPY[dto.language];

    await Promise.all([
      this.mailService.send({
        type: 'contact-message',
        to: CONTACT_RECIPIENT,
        subject:
          `[Kontaktformular] ${subject}`,
        hello:
          'Neue Nachricht über das Kontaktformular',
        content: [
          `Name: ${name}`,
          `E-Mail: ${email}`,
          `Betreff: ${subject}`,
          '',
          'Nachricht:',
          message,
        ].join('\n'),
        context: {
          source: 'contact-form',
        },
      }),
      this.mailService.send({
        type: 'contact-confirmation',
        to: email,
        subject: confirmation.subject,
        hello:
          confirmation.hello(name),
        content: [
          confirmation.intro,
          '',
          `${confirmation.subjectLabel}: ${subject}`,
          '',
          `${confirmation.messageLabel}:`,
          message,
          '',
          confirmation.outro,
        ].join('\n'),
        context: {
          source: 'contact-form',
        },
      }),
    ]);
  }

  private assertRateLimit(
    email: string,
  ): void {
    const now = Date.now();
    const key = email.toLowerCase();
    const previous =
      this.lastSubmissionByEmail.get(key);

    if (
      previous !== undefined &&
      now - previous <
        SUBMISSION_COOLDOWN_MS
    ) {
      throw new HttpException(
        'Please wait before sending another contact request.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    this.lastSubmissionByEmail.set(
      key,
      now,
    );

    if (
      this.lastSubmissionByEmail.size <=
      1000
    ) {
      return;
    }

    for (const [
      storedEmail,
      timestamp,
    ] of this.lastSubmissionByEmail) {
      if (
        now - timestamp >
        SUBMISSION_COOLDOWN_MS
      ) {
        this.lastSubmissionByEmail.delete(
          storedEmail,
        );
      }
    }
  }
}
