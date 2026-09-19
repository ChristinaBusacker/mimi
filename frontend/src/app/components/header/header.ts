import { Component } from '@angular/core';
import { Button } from '../button/button';
import { Icon } from '../icon/icon';

@Component({
  imports: [Button, Icon],
  selector: 'app-header',
  styleUrl: './header.scss',
  templateUrl: './header.html',
})
export class Header {}
