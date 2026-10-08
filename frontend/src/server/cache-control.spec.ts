import { describe, expect, it } from 'vitest';

import {
  IMMUTABLE_CACHE_CONTROL,
  REVALIDATE_CACHE_CONTROL,
  staticCacheControl,
} from './cache-control';

describe('staticCacheControl', () => {
  it.each(['main-A7SFBP3X.js', 'styles.Q2CX1N5H.css', 'chunk-B8T9X1QD.mjs'])(
    'caches the fingerprinted bundle %s as immutable',
    (fileName) => {
      expect(staticCacheControl(fileName)).toBe(IMMUTABLE_CACHE_CONTROL);
    },
  );

  it.each([
    'ngsw.json',
    'ngsw-worker.js',
    'index.html',
    'manifest.webmanifest',
    'background.png',
    'more-sugar.ttf',
    'main.js',
  ])('revalidates %s', (fileName) => {
    expect(staticCacheControl(fileName)).toBe(REVALIDATE_CACHE_CONTROL);
  });
});
