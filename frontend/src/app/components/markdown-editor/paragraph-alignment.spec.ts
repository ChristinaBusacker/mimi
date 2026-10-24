import { describe, expect, it } from 'vitest';
import MarkdownIt from 'markdown-it';
import { installMimiParagraphAlignment } from '@shared/content/mimi-markdown-rendering';

const markdown = new MarkdownIt({ html: false });
installMimiParagraphAlignment(markdown);

describe('paragraph alignment rendering', () => {
  it('renders Candy paragraphs without affecting the next paragraph', () => {
    const result = markdown.render(':::candy\n**Candy highlight**\n:::\n\nNormal paragraph');
    expect(result).toContain('<p class="mimi-candy"><strong>Candy highlight</strong></p>');
    expect(result).toContain('<p>Normal paragraph</p>');
  });
  it('combines Candy and center alignment in a single paragraph', () => {
    const result = markdown.render(':::align-center-candy\nCandy\n:::');
    expect(result).toContain('<p style="text-align:center" class="mimi-candy">Candy</p>');
  });
  it('renders per-paragraph alignment without changing the next paragraph', () => {
    const result = markdown.render(':::align-center\n**Centered** text\n:::\n\nOrdinary text');
    expect(result).toContain('<p style="text-align:center"><strong>Centered</strong> text</p>');
    expect(result).toContain('<p>Ordinary text</p>');
  });
  it('never enables user-supplied HTML', () => {
    const result = markdown.render(':::align-right\n<script>alert(1)</script>\n:::');
    expect(result).not.toContain('<script>');
  });
});
