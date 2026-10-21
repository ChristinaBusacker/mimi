import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/** A single, reusable RGBA editor. Persisted colors are canonical #RRGGBBAA. */
@Component({
  selector: 'app-composer-color-picker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <details class="color-picker">
      <summary [attr.aria-label]="label()">
        <span class="color-picker__checker"><span [style.background]="value()"></span></span>
        <code>{{ normalized() }}</code>
      </summary>
      <div class="color-picker__panel">
        <label>{{ label() }}
          <input type="color" [value]="normalized().slice(0, 7)" (input)="rgbChanged($event)" />
        </label>
        <label>Alpha · {{ opacity() }}%
          <input type="range" min="0" max="100" step="1" [value]="opacity()" (input)="alphaChanged($event)" />
        </label>
        <label>HEX / RGBA
          <input type="text" spellcheck="false" maxlength="9" [value]="normalized()"
            (change)="hexChanged($event)" aria-label="Hexadecimal color with alpha" />
        </label>
        <div class="color-picker__swatches" aria-label="Palette">
          @for (swatch of swatches; track swatch) {
            <button type="button" [style.background]="swatch" [attr.aria-label]="swatch"
              (click)="valueChange.emit(swatch)"></button>
          }
        </div>
      </div>
    </details>
  `,
  styles: [`
    :host { display: block; min-width: 0; }
    .color-picker { position: relative; min-width: 0; }
    summary { display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 8px;
      background: #211928; border: 1px solid #795c81; border-radius: 8px; list-style: none; }
    summary::-webkit-details-marker { display: none; }
    summary::after { content: '⌄'; margin-left: auto; }
    summary code { color: #f6d6eb; font: 0.8rem ui-monospace, monospace; overflow: hidden; text-overflow: ellipsis; }
    .color-picker__checker { display: inline-flex; flex: 0 0 36px; width: 36px; height: 28px;
      border-radius: 5px; padding: 0; overflow: hidden; background-color: #ddd;
      background-image: linear-gradient(45deg, #999 25%, transparent 25%),
        linear-gradient(-45deg, #999 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, #999 75%),
        linear-gradient(-45deg, transparent 75%, #999 75%);
      background-size: 12px 12px; background-position: 0 0, 0 6px, 6px -6px, -6px 0; }
    .color-picker__checker span { width: 100%; height: 100%; }
    .color-picker__panel { position: relative; z-index: 5; display: grid; gap: 11px;
      margin-top: 5px; padding: 12px; background: #2b2035; border: 1px solid #937197;
      border-radius: 9px; box-shadow: 0 14px 36px #0d0719b0; }
    label { display: grid; gap: 5px; font-size: .82rem; color: #edd5e7; }
    input { width: 100%; min-width: 0; box-sizing: border-box; }
    input[type='color'] { min-height: 42px; cursor: pointer; padding: 2px; }
    input[type='range'] { accent-color: #df9ac5; }
    input[type='text'] { color: #fff; background: #211928; border: 1px solid #866789;
      border-radius: 6px; padding: 8px; font: .82rem ui-monospace, monospace; }
    .color-picker__swatches { display: flex; gap: 6px; }
    .color-picker__swatches button { width: 30px; height: 30px; border-radius: 50%;
      border: 2px solid #d9b6d4; cursor: pointer; }
  `],
})
export class ComposerColorPicker {
  readonly value = input.required<string>();
  readonly label = input('Color');
  readonly valueChange = output<string>();
  protected readonly swatches = ['#da8dbbff', '#33223dff', '#875772ff', '#ffffffff', '#00000000'];

  protected normalized(): string {
    const value = this.value();
    if (/^#[0-9a-f]{6}$/i.test(value)) return `${value.toLowerCase()}ff`;
    return /^#[0-9a-f]{8}$/i.test(value) ? value.toLowerCase() : '#000000ff';
  }
  protected opacity(): number {
    return Math.round(parseInt(this.normalized().slice(7), 16) * 100 / 255);
  }
  protected rgbChanged(event: Event): void {
    const rgb = (event.target as HTMLInputElement).value;
    if (/^#[0-9a-f]{6}$/i.test(rgb)) this.valueChange.emit(rgb.toLowerCase() + this.normalized().slice(7));
  }
  protected alphaChanged(event: Event): void {
    const raw = Number((event.target as HTMLInputElement).value);
    const percent = Math.min(100, Math.max(0, raw));
    this.valueChange.emit(this.normalized().slice(0, 7) + Math.round(percent * 255 / 100).toString(16).padStart(2, '0'));
  }
  protected hexChanged(event: Event): void {
    const raw = (event.target as HTMLInputElement).value.trim();
    if (/^#[0-9a-f]{8}$/i.test(raw)) this.valueChange.emit(raw.toLowerCase());
    else if (/^#[0-9a-f]{6}$/i.test(raw)) this.valueChange.emit(raw.toLowerCase() + this.normalized().slice(7));
    else (event.target as HTMLInputElement).value = this.normalized();
  }
}
