import { ChangeDetectionStrategy, Component } from '@angular/core';

import { ContentPage } from '../../components/content-page/content-page';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ContentPage],
  selector: 'app-legal-notice',
  templateUrl: './legal-notice.html',
})
export class LegalNotice {}
