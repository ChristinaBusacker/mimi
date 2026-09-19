import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';

const STORAGE_PREFIX = 'mimi:';

@Injectable({
  providedIn: 'root',
})
export class LocalStorageService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  get<T>(key: string): T | null {
    const storage = this.getStorage();

    if (!storage) {
      return null;
    }

    const value = storage.getItem(this.getKey(key));

    if (value === null) {
      return null;
    }

    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }

  set<T>(key: string, value: T): void {
    const storage = this.getStorage();

    if (!storage) {
      return;
    }

    try {
      storage.setItem(this.getKey(key), JSON.stringify(value));
    } catch {
      // Storage can be unavailable or full. User settings must not break the app.
    }
  }

  remove(key: string): void {
    const storage = this.getStorage();

    if (!storage) {
      return;
    }

    try {
      storage.removeItem(this.getKey(key));
    } catch {
      // Storage can be unavailable. Removing a setting is best-effort.
    }
  }

  private getStorage(): Storage | null {
    if (!this.isBrowser) {
      return null;
    }

    try {
      return localStorage;
    } catch {
      return null;
    }
  }

  private getKey(key: string): string {
    return `${STORAGE_PREFIX}${key}`;
  }
}
