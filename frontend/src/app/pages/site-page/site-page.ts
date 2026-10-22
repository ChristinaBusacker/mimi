import type { SitePagePublic } from '@shared/content/site-page';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { Store } from '@ngxs/store';
import { map } from 'rxjs';

import { PageRenderer } from '../../components/page-composer/page-renderer';
import { I18nState } from '../../core/i18n/i18n.state';
import { NotFoundPage } from '../not-found/not-found';

@Component({
  selector: 'app-site-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageRenderer, NotFoundPage],
  templateUrl: './site-page.html',
  styleUrl: './site-page.scss',
})
export class SitePage {
  private readonly route = inject(ActivatedRoute);
  private readonly store = inject(Store);

  protected readonly language = this.store.selectSignal(I18nState.language);
  // route.data changes when navigating between two /:slug pages without destroying this component.
  protected readonly page = toSignal(
    this.route.data.pipe(map((data) => data['data'] as SitePagePublic | null)),
    { initialValue: this.route.snapshot.data['data'] as SitePagePublic | null },
  );
}
