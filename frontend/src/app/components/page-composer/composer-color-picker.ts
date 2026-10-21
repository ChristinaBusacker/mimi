import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ColorPickerDirective } from 'ngx-color-picker';

/** A single, reusable RGBA editor. Persisted colors are canonical #RRGGBBAA. */
@Component({
  selector: 'app-composer-color-picker',
  standalone: true,
  imports: [ColorPickerDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="color-picker__trigger"
      [disabled]="disabled()"
      [attr.aria-label]="label()"
      [title]="label()"
      [colorPicker]="rgba()"
      cpAlphaChannel="always"
      cpOutputFormat="rgba"
      cpPosition="bottom"
      [cpUseRootViewContainer]="true"
      [cpPresetColors]="swatches"
      [cpSaveClickOutside]="true"
      (colorPickerChange)="colorChanged($event)"
    >
      <span class="color-picker__checker"><span [style.background]="normalized()"></span></span>
      <code>{{ normalized() }}</code>
      <span aria-hidden="true">▾</span>
    </button>
  `,
  styles: [
    `
      :host {
        display: block;
        min-width: 0;
        position: relative;
      }
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
