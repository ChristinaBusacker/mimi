import { ChangeDetectionStrategy, Component } from '@angular/core';

import { ContentPage } from '../../components/content-page/content-page';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ContentPage],
  selector: 'app-contact',
  templateUrl: './contact.html',
})
export class Contact {}
