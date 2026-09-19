import { AsyncPipe } from '@angular/common';
import { Component } from '@angular/core';

import { Button } from '../../components/button/button';
import { Icon } from '../../components/icon/icon';
import { I18nPipe } from '../../core/i18n/i18n.pipe';

@Component({
  imports: [AsyncPipe, Button, I18nPipe, Icon],
  selector: 'app-home',
  styleUrl: './home.scss',
  templateUrl: './home.html',
})
export class Home {}
