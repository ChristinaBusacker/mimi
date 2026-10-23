import type { SitePagePublic } from '@shared/content/site-page';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { Store } from '@ngxs/store';
import { map } from 'rxjs';

import { PageRenderer } from '../../components/page-composer/page-renderer';
import { I18nState } from '../../core/i18n/i18n.state';
import { About } from '../about/about';
import { LegalNotice } from '../legal-notice/legal-notice';
import { Privacy } from '../privacy/privacy';

/** Keep the original legal/about content available until a replacement is published. */
@Component({
  selector: 'app-system-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageRenderer, About, LegalNotice, Privacy],
  templateUrl: './system-page.html',
  styleUrl: './system-page.scss',
  styles: ':host {}',
})
export class SystemPage {
  private readonly route = inject(ActivatedRoute);
  private readonly store = inject(Store);

  protected readonly slug = this.route.snapshot.data['systemSlug'] as
    'about' | 'impressum' | 'datenschutz';
  protected readonly language = this.store.selectSignal(I18nState.language);
  protected readonly page = toSignal(
    this.route.data.pipe(map((data) => data['data'] as SitePagePublic | null)),
    { initialValue: this.route.snapshot.data['data'] as SitePagePublic | null },
  );
}
