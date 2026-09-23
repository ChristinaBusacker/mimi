import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import mjml2html from 'mjml';

import type {
  MailCta,
  RenderedMail,
} from './mail.types';

interface RenderMailTemplateInput {
  hello: string;
  content: string;
  cta?: MailCta;
}

@Injectable()
export class MailTemplateService {
  constructor(
    private readonly configService:
      ConfigService,
  ) {}

  async render(
    input: RenderMailTemplateInput,
  ): Promise<RenderedMail> {
    const siteUrl =
      this.getPublicSiteUrl();
    const source =
      await this.getTemplateSource();
    const mjml =
      this.replacePlaceholders(
        source,
        {
          preview:
            this.escapeHtml(
              this.createPreview(
                input.content,
              ),
            ),
          logoUrl:
            this.escapeHtml(
              new URL(
                '/images/logo.png',
                siteUrl,
              ).toString(),
            ),
          siteUrl:
            this.escapeHtml(
              siteUrl,
            ),
          hello:
            this.renderPlainTextAsHtml(
              input.hello,
            ),
          content:
            this.renderPlainTextAsHtml(
              input.content,
            ),
          cta: input.cta
            ? this.renderCta(
                input.cta,
              )
            : '',
        },
      );

    const result =
      await mjml2html(
        mjml,
        {
          validationLevel:
            'strict',
        },
      );

    return {
      html: result.html,
      text: this.renderText(
        input,
        siteUrl,
      ),
    };
  }

  private getTemplateSource():
    Promise<string> {
    return readFile(
      join(
        __dirname,
        'templates',
        'base.mjml',
      ),
      'utf8',
    );
  }

  private getPublicSiteUrl(): string {
    const value =
      this.configService
        .getOrThrow<string>(
          'PUBLIC_SITE_URL',
        );
    const url = new URL(value);

    this.assertHttpUrl(
      url,
      'PUBLIC_SITE_URL',
    );

    return url.toString();
  }

  private renderCta(
    cta: MailCta,
  ): string {
    const url = new URL(cta.url);

    this.assertHttpUrl(
      url,
      'Mail CTA URL',
    );

    return [
      '<mj-button',
      '  background-color="#af68a7"',
      '  color="#ffffff"',
      '  border-radius="24px"',
      '  font-size="16px"',
      '  font-weight="700"',
      '  inner-padding="13px 24px"',
      '  padding="10px 0 4px"',
      `  href="${this.escapeHtml(url.toString())}"`,
      '>',
      `  ${this.escapeHtml(cta.label)}`,
      '</mj-button>',
    ].join('\n');
  }

  private renderText(
    input: RenderMailTemplateInput,
    siteUrl: string,
  ): string {
    return [
      input.hello.trim(),
      '',
      input.content.trim(),
      ...(input.cta
        ? [
            '',
            `${input.cta.label}: ${input.cta.url}`,
          ]
        : []),
      '',
      'Mimis Show',
      siteUrl,
    ].join('\n');
  }

  private renderPlainTextAsHtml(
    value: string,
  ): string {
    return this.escapeHtml(value)
      .replace(
        /\r?\n/g,
        '<br />',
      );
  }

  private createPreview(
    content: string,
  ): string {
    return content
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 140);
  }

  private replacePlaceholders(
    template: string,
    replacements:
      Readonly<Record<string, string>>,
  ): string {
    return template.replace(
      /{{([a-zA-Z][a-zA-Z0-9]*)}}/g,
      (match: string, key: string) => {
        const replacement =
          replacements[key];

        if (replacement === undefined) {
          throw new Error(
            `Missing mail template value for "${key}" in ${match}.`,
          );
        }

        return replacement;
      },
    );
  }

  private escapeHtml(
    value: string,
  ): string {
    const characters:
      Readonly<Record<string, string>> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
      };

    return value.replace(
      /[&<>"']/g,
      (character) =>
        characters[character] ??
        character,
    );
  }

  private assertHttpUrl(
    url: URL,
    label: string,
  ): void {
    if (
      url.protocol !== 'http:' &&
      url.protocol !== 'https:'
    ) {
      throw new Error(
        `${label} must use HTTP or HTTPS.`,
      );
    }
  }
}
