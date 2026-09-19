import { Component } from '@angular/core';
import { Icon } from '../../components/icon/icon';
import { Button } from '../../components/button/button';

@Component({
  imports: [Icon, Button],
  selector: 'app-home',
  styleUrl: './home.scss',
  templateUrl: './home.html',
})
export class Home {}
