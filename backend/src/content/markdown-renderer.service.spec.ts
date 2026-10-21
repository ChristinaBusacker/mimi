import { describe, expect, it } from 'vitest';
import { MarkdownRendererService } from './markdown-renderer.service';
import { parseMimiMediaTitle } from './mimi-markdown-rendering';

const ID = '123e4567-e89b-42d3-a456-426614174000';

describe('Mimi Markdown display roundtrip', () => {
  const renderer = new MarkdownRendererService();

  it('accepts old and new image layouts without changing asset references', () => {
    expect(parseMimiMediaTitle('mimi-media:center:large')?.widthPercent).toBeNull();
    expect(parseMimiMediaTitle('mimi-media:right:large:65')?.widthPercent).toBe(65);
    expect(parseMimiMediaTitle('mimi-media:right:large:9')).toBeNull();
    const html = renderer.render(`![Cover](asset:${ID} "mimi-media:right:large:65")`);
    expect(html).toContain(`src="/api/assets/${ID}/image/large/fallback"`);
    expect(html).toMatch(/<picture[^>]*style="width:65%;max-width:100%"/);
    expect(html).toContain('media-right');
  });

  it('renders colored, nested emphasis and alpha, but rejects raw HTML', () => {
    const html = renderer.render('%%#fabcde80[**Lila** und *weich*]%% <script>alert(1)</script>');
    expect(html).toContain('color:#fabcde80');
    expect(html).toContain('<strong>Lila</strong>');
    expect(html).toContain('<em>weich</em>');
    expect(html).not.toContain('<script>');
  });

  it('does not allow CSS injection via a malformed color mark', () => {
    const html = renderer.render('%%#ff0000;background:red[Text]%%');
    expect(html).not.toContain('style="color:#ff0000;background:red"');
  });
});
