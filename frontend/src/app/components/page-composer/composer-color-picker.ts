import {
  ChangeDetectionStrategy, Component, DestroyRef, ElementRef,
  afterNextRender, inject, input, output, signal, viewChild,
} from '@angular/core';
import { ColorPickerDirective } from 'ngx-color-picker';

/** A single, reusable RGBA editor. Persisted colors are canonical #RRGGBBAA. */
@Component({
  selector: 'app-composer-color-picker',
  standalone: true,
  imports: [ColorPickerDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="color-picker__label">{{ label() }}</span>
    <button
      #trigger
      type="button"
      class="color-picker__trigger"
      [disabled]="disabled()"
      [attr.aria-label]="label()"
      [attr.aria-expanded]="isOpen()"
      [title]="label()"
      (click)="togglePicker()"
    >
      <span class="color-picker__checker"><span [style.background]="normalized()"></span></span>
      <code>{{ normalized() }}</code>
      <span aria-hidden="true">▾</span>
    </button>
    <!-- Popover is promoted to the browser top layer, escaping sticky/scroll containers. -->
    <div #popover popover="auto" class="color-picker__popover"
      [style.top.px]="popoverTop()" [style.left.px]="popoverLeft()"
      (toggle)="onPopoverToggle()">
      <span class="color-picker__inline"
        [colorPicker]="rgba()"
        cpDialogDisplay="inline"
        [cpToggle]="isOpen()"
        cpAlphaChannel="always"
        cpOutputFormat="rgba"
        [cpPresetColors]="swatches"
        (colorPickerChange)="colorChanged($event)"></span>
    </div>
  `,
  styles: [
    `
      :host {
        display: grid;
        gap: 5px;
        min-width: 0;
      }
      .color-picker__label {
        font-size: 0.78rem;
        font-weight: 600;
        color: #edd5e7;
      }
      .color-picker__popover:popover-open {
        position: fixed;
        inset: auto;
        margin: 0;
        box-sizing: border-box;
        width: max-content;
        min-width: 250px;
        max-width: min(340px, calc(100vw - 16px));
        max-height: calc(100dvh - 16px);
        padding: 10px;
        overflow: auto;
        border: 1px solid #99769e;
        border-radius: 12px;
        background: #2b2035;
        color: #f6d6eb;
        box-shadow: 0 15px 40px #0d0719b0;
      }
      .color-picker__inline { display: block; min-width: 230px; }
      .color-picker__trigger {
        display: flex;
        width: 100%;
        align-items: center;
        gap: 9px;
        padding: 7px 9px;
        text-align: left;
        cursor: pointer;
        border-radius: 8px;
        color: #f6d6eb;
        background: #211928;
        border: 1px solid #795c81;
      }
      .color-picker__trigger:focus-visible {
        outline: 2px solid #d68cbd;
        outline-offset: 2px;
      }
      .color-picker__trigger > code {
        flex: 1;
        font:
          0.8rem ui-monospace,
          monospace;
      }
      .color-picker__checker {
        display: inline-flex;
        width: 34px;
        height: 27px;
        flex: 0 0 34px;
        overflow: hidden;
        border-radius: 5px;
        background: conic-gradient(#aaa 25%, #eee 0 50%, #aaa 0 75%, #eee 0) 0 0 / 12px 12px;
      }
      .color-picker__checker span {
        width: 100%;
        height: 100%;
      }
    `,
  ],
})
export class ComposerColorPicker {
  private readonly trigger = viewChild<ElementRef<HTMLButtonElement>>('trigger');
  private readonly popover = viewChild<ElementRef<HTMLElement>>('popover');
  private readonly destroyRef = inject(DestroyRef);
  protected readonly isOpen = signal(false);
  protected readonly popoverTop = signal(8);
  protected readonly popoverLeft = signal(8);

  constructor() {
    afterNextRender(() => {
      const doc = this.trigger()?.nativeElement.ownerDocument;
      const win = doc?.defaultView;
      if (!doc || !win) return;
      const update = () => this.positionPicker();
      // Capture scroll events from the inspector as well as the page itself.
      doc.addEventListener('scroll', update, true);
      win.addEventListener('resize', update);
      this.destroyRef.onDestroy(() => {
        doc.removeEventListener('scroll', update, true);
        win.removeEventListener('resize', update);
      });
    });
  }

  protected togglePicker(): void {
    if (this.disabled()) return;
    const element = this.popover()?.nativeElement;
    if (!element) return;
    if (element.matches(':popover-open')) {
      element.hidePopover();
    } else {
      element.showPopover();
      this.isOpen.set(true);
      this.positionPicker();
      // Measure the ngx inline dialog after Angular has rendered it.
      requestAnimationFrame(() => this.positionPicker());
    }
  }

  protected onPopoverToggle(): void {
    const expanded = this.popover()?.nativeElement.matches(':popover-open') ?? false;
    this.isOpen.set(expanded);
    if (expanded) this.positionPicker();
  }

  private positionPicker(): void {
    const trigger = this.trigger()?.nativeElement;
    const element = this.popover()?.nativeElement;
    if (!trigger || !element || !element.matches(':popover-open')) return;
    const viewport = trigger.ownerDocument.defaultView;
    if (!viewport) return;
    const rect = trigger.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > viewport.innerHeight || rect.right < 0) {
      element.hidePopover();
      return;
    }
    const size = element.getBoundingClientRect();
    const width = Math.max(size.width, 250);
    const height = Math.max(size.height, 280);
    const left = Math.max(8, Math.min(rect.left, viewport.innerWidth - width - 8));
    const below = rect.bottom + 8;
    const top = below + height <= viewport.innerHeight - 8
      ? below
      : Math.max(8, rect.top - height - 8);
    this.popoverLeft.set(left);
    this.popoverTop.set(top);
  }

  readonly disabled = input<boolean>(false);
  readonly value = input.required<string>();
  readonly label = input('Color');
  readonly valueChange = output<string>();
  protected readonly swatches = [
    'rgba(218,141,187,1)',
    'rgba(51,34,61,1)',
    'rgba(135,87,114,1)',
    'rgba(255,255,255,1)',
    'rgba(0,0,0,0)',
  ];

  protected normalized(): string {
    const value = this.value();
    if (/^#[0-9a-f]{6}$/i.test(value)) return `${value.toLowerCase()}ff`;
    return /^#[0-9a-f]{8}$/i.test(value) ? value.toLowerCase() : '#000000ff';
  }
  protected rgba(): string {
    const hex = this.normalized();
    const components = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16));
    return `rgba(${components[0]},${components[1]},${components[2]},${(parseInt(hex.slice(7), 16) / 255).toFixed(4)})`;
  }
  protected colorChanged(value: string): void {
    const match =
      /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(0(?:\.\d+)?|1(?:\.0+)?))?\s*\)$/i.exec(
        value,
      );
    if (!match) return;
    const rgb = match.slice(1, 4).map(Number);
    if (rgb.some((component) => component > 255)) return;
    const alpha = Math.min(1, Math.max(0, Number(match[4] ?? '1')));
    const hex = rgb.map((component) => component.toString(16).padStart(2, '0')).join('');
    this.valueChange.emit(
      `#${hex}${Math.round(alpha * 255)
        .toString(16)
        .padStart(2, '0')}`,
    );
  }
}
