import { Component, input } from '@angular/core';

@Component({
  imports: [],
  selector: 'app-icon',
  styleUrl: './icon.scss',
  templateUrl: './icon.html',
})
export class Icon {
  public name = input('circle');
}
