import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  computed,
  inject,
  input,
} from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import type { SafeHtml } from '@angular/platform-browser';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  selector: 'app-rendered-content',
  styleUrl: './rendered-content.scss',
  templateUrl: './rendered-content.html',
})
export class RenderedContent {
  private readonly sanitizer = inject(DomSanitizer);

  readonly sanitizedHtml =
    input.required<string>();

  protected readonly content = computed<SafeHtml>(
    () =>
      this.sanitizer.bypassSecurityTrustHtml(
        this.sanitizedHtml(),
      ),
  );
}
