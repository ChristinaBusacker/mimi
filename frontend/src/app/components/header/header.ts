import { AsyncPipe } from '@angular/common';
import { Component } from '@angular/core';

import { I18nPipe } from '../../core/i18n/i18n.pipe';
import { Button } from '../button/button';
import { Icon } from '../icon/icon';

@Component({
  imports: [AsyncPipe, Button, I18nPipe, Icon],
  selector: 'app-header',
  styleUrl: './header.scss',
  templateUrl: './header.html',
})
export class Header {}
