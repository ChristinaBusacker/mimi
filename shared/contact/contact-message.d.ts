export type ContactLanguage =
  | 'de'
  | 'en';

export interface ContactMessageRequest {
  name: string;
  email: string;
  subject: string;
  message: string;
  language: ContactLanguage;
  website?: string;
}
