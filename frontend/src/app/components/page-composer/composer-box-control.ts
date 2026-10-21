import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import type { ComposerBoxEdges } from '@shared/content/page-document';

type Edge = keyof ComposerBoxEdges;
type Lock = 'all' | 'horizontal' | 'vertical';
const PRESETS = { none: 0, xs: 4, s: 8, m: 16, l: 32, xl: 64 } as const;
type Preset = keyof typeof PRESETS;
const SIDES: readonly Edge[] = ['top', 'right', 'bottom', 'left'];

@Component({
  selector: 'app-composer-box-control',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="box-control">
      <div class="box-control__heading"><strong>{{ label() }}</strong>
        <div class="box-control__locks">
          <button type="button" [class.active]="locks().has('all')" [attr.aria-pressed]="locks().has('all')"
            aria-label="Alle Seiten koppeln" title="Alle Seiten koppeln" (click)="toggleLock('all')">⛓</button>
          <button type="button" [class.active]="locks().has('horizontal')" [attr.aria-pressed]="locks().has('horizontal')"
            aria-label="Links und rechts koppeln" title="Links und rechts koppeln" (click)="toggleLock('horizontal')">↔</button>
          <button type="button" [class.active]="locks().has('vertical')" [attr.aria-pressed]="locks().has('vertical')"
            aria-label="Oben und unten koppeln" title="Oben und unten koppeln" (click)="toggleLock('vertical')">↕</button>
        </div>
      </div>
      <select aria-label="Abstands-Vorlage" [value]="preset()" (change)="setPreset($event)">
        <option value="legacy">Bisheriger Abstand (beibehalten)</option>
        <option value="none">Keiner · 0 px</option>
        <option value="xs">XS · 4 px</option>
        <option value="s">S · 8 px</option>
        <option value="m">M · 16 px</option>
        <option value="l">L · 32 px</option>
        <option value="xl">XL · 64 px</option>
        <option value="custom">Individuell</option>
      </select>
      @if (value(); as edges) {
        <div class="box-control__grid">
          <label class="box-control__top">Oben
            <input type="number" min="0" max="160" step="1" [value]="edges.top"
              (change)="setEdge('top', $event)" /></label>
          <label class="box-control__left">Links
            <input type="number" min="0" max="160" step="1" [value]="edges.left"
              (change)="setEdge('left', $event)" /></label>
          <span class="box-control__preview" aria-hidden="true">Inhalt</span>
          <label class="box-control__right">Rechts
            <input type="number" min="0" max="160" step="1" [value]="edges.right"
              (change)="setEdge('right', $event)" /></label>
          <label class="box-control__bottom">Unten
            <input type="number" min="0" max="160" step="1" [value]="edges.bottom"
              (change)="setEdge('bottom', $event)" /></label>
        </div>
      }
    </div>
  `,
  styles: [`
    .box-control { display: grid; gap: 10px; min-width: 0; padding: 9px 0 12px; }
    .box-control + .box-control { border-top: 1px solid #715477; }
    .box-control__heading { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
    .box-control__heading strong { font-size: .85rem; }
    .box-control__locks { display: flex; gap: 4px; }
    .box-control__locks button { border: 1px solid #84618c; border-radius: 7px;
      background: #34253c; color: #f8d8ec; min-width: 29px; height: 29px; }
    .box-control__locks button.active { background: #a35c86; border-color: #f1a9d2; }
    .box-control select { width: 100%; min-width: 0; padding: 7px; color: #f8ddec;
      background: #302039; border: 1px solid #84618c; border-radius: 7px; }
    .box-control__grid { display: grid; align-items: center; gap: 7px;
      grid-template-columns: minmax(0,1fr) 66px minmax(0,1fr);
      grid-template-rows: auto 64px auto; }
    label { min-width: 0; display: grid; gap: 4px; font-size: .75rem; }
    input { min-width: 0; width: 100%; box-sizing: border-box; border: 1px solid #87618a;
      border-radius: 6px; background: #291c32; color: #fff; padding: 7px 4px; }
    .box-control__top { grid-area: 1 / 2; }
    .box-control__left { grid-area: 2 / 1; }
    .box-control__right { grid-area: 2 / 3; }
    .box-control__bottom { grid-area: 3 / 2; }
    .box-control__preview { grid-area: 2 / 2; border: 2px solid #b67eaa; border-radius: 5px;
      display: grid; place-items: center; font-size: .7rem; background: #543456; }
  `],
})
export class ComposerBoxControl {
  readonly label = input('Abstand');
  readonly value = input<ComposerBoxEdges | null>(null);
  readonly valueChange = output<ComposerBoxEdges | null>();
  protected readonly locks = signal<ReadonlySet<Lock>>(new Set());
  protected preset(): Preset | 'legacy' | 'custom' {
    const value = this.value();
    if (!value) return 'legacy';
    for (const [key, size] of Object.entries(PRESETS) as [Preset, number][]) {
      if (SIDES.every((side) => value[side] === size)) return key;
    }
    return 'custom';
  }
  protected setPreset(event: Event): void {
    const raw = (event.target as HTMLSelectElement).value;
    if (raw === 'legacy') { this.valueChange.emit(null); return; }
    if (raw === 'custom') {
      this.valueChange.emit(this.value() ?? { top: 0, right: 0, bottom: 0, left: 0 });
      return;
    }
    if (!(raw in PRESETS)) return;
    const size = PRESETS[raw as Preset];
    this.valueChange.emit({ top: size, right: size, bottom: size, left: size });
  }
  protected toggleLock(lock: Lock): void {
    const next = new Set(this.locks());
    if (next.has(lock)) next.delete(lock);
    else if (lock === 'all') { next.clear(); next.add('all'); }
    else { next.delete('all'); next.add(lock); }
    this.locks.set(next);
    const current = this.value();
    if (!next.has(lock) || !current) return;
    if (lock === 'all') {
      const size = current.top;
      this.valueChange.emit({ top: size, right: size, bottom: size, left: size });
    } else if (lock === 'horizontal') {
      this.valueChange.emit({ ...current, right: current.left });
    } else {
      this.valueChange.emit({ ...current, bottom: current.top });
    }
  }
  protected setEdge(edge: Edge, event: Event): void {
    const raw = Number((event.target as HTMLInputElement).value);
    if (!Number.isFinite(raw)) return;
    const number = Math.max(0, Math.min(160, Math.round(raw)));
    const value: ComposerBoxEdges = { top: 0, right: 0, bottom: 0, left: 0, ...this.value() };
    value[edge] = number;
    const locks = this.locks();
    if (locks.has('all')) for (const side of SIDES) value[side] = number;
    else {
      if (locks.has('horizontal') && (edge === 'left' || edge === 'right')) {
        value.left = number; value.right = number;
      }
      if (locks.has('vertical') && (edge === 'top' || edge === 'bottom')) {
        value.top = number; value.bottom = number;
      }
    }
    this.valueChange.emit(value);
  }
}
