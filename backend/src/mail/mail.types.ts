export type MailDeliveryStatus =
  | 'pending'
  | 'sent'
  | 'failed';

export type MailType =
  | 'password-reset'
  | 'password-changed'
  | 'peer-review-requested'
  | 'peer-review-completed'
  | 'contact-confirmation'
  | 'stream-reminder';

export interface MailCta {
  label: string;
  url: string;
}

export interface SendMailInput {
  type: MailType;
  to: string;
  subject: string;
  hello: string;
  content: string;
  cta?: MailCta;
  userUuid?: string | null;
  context?: Readonly<Record<string, string>>;
}

export interface RenderedMail {
  html: string;
  text: string;
}

export interface MailDeliveryResult {
  id: string;
  status: 'sent';
  providerMessageId: string | null;
}

export interface MailTransportMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}
