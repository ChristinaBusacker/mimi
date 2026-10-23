import { describe, expect, it } from 'vitest';
import MarkdownIt from 'markdown-it';
import { installMimiParagraphAlignment } from '@shared/content/mimi-markdown-rendering';

const markdown = new MarkdownIt({ html: false });
installMimiParagraphAlignment(markdown);

describe('paragraph alignment rendering', () => {
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
