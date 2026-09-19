import { NgTemplateOutlet } from '@angular/common';
import { Component, input } from '@angular/core';

@Component({
  imports: [NgTemplateOutlet],
  selector: 'app-button',
  styleUrl: './button.scss',
  templateUrl: './button.html',
})
export class Button {
  readonly href = input<string | null>(null);
  readonly target = input<'_self' | '_blank'>('_self');
}
