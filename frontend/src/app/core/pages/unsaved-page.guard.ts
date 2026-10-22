import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID, inject } from '@angular/core';
import type { CanDeactivateFn } from '@angular/router';

/** Works with lazy-loaded editors without importing a component into the route configuration. */
export const unsavedPageGuard: CanDeactivateFn<{ hasUnsavedChanges(): boolean }> = (component) => {
  if (!component.hasUnsavedChanges()) return true;
  if (!isPlatformBrowser(inject(PLATFORM_ID))) return false;
  return window.confirm('Nicht gespeicherte Änderungen verwerfen? / Discard unsaved changes?');
};
