import type { Language } from './i18n.types';

export class SetLanguage {
  static readonly type = '[I18n] Set Language';

  constructor(public readonly language: Language) {}
}
