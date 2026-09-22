import {
  Injectable,
  computed,
  signal,
} from '@angular/core';

export interface LightboxItem {
  src: string;
  alt: string;
}

@Injectable({
  providedIn: 'root',
})
export class LightboxService {
  private readonly itemsState =
    signal<readonly LightboxItem[]>([]);
  private readonly indexState = signal(0);

  readonly items = this.itemsState.asReadonly();
  readonly index = this.indexState.asReadonly();

  readonly current = computed(
    () =>
      this.itemsState()[this.indexState()] ??
      null,
  );

  readonly count = computed(
    () => this.itemsState().length,
  );

  readonly hasMultiple = computed(
    () => this.itemsState().length > 1,
  );

  open(
    items: readonly LightboxItem[],
    index = 0,
  ): void {
    if (items.length === 0) {
      return;
    }

    this.itemsState.set(items);
    this.indexState.set(
      Math.min(
        Math.max(index, 0),
        items.length - 1,
      ),
    );
  }

  close(): void {
    this.itemsState.set([]);
    this.indexState.set(0);
  }

  next(): void {
    const count = this.itemsState().length;

    if (count < 2) {
      return;
    }

    this.indexState.update(
      (index) => (index + 1) % count,
    );
  }

  previous(): void {
    const count = this.itemsState().length;

    if (count < 2) {
      return;
    }

    this.indexState.update(
      (index) => (index - 1 + count) % count,
    );
  }
}
