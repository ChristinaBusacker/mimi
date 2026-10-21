import { Schema } from '@tiptap/pm/model';
import { normalizeMarkdownDocument } from './normalize-markdown-document';

const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: {
      group: 'block', content: 'inline*',
      parseDOM: [{ tag: 'p' }], toDOM: () => ['p', 0],
    },
    text: { group: 'inline' },
  },
});

describe('Markdown document validity', () => {
  it('does not replace an already valid document', () => {
    const doc = schema.node('doc', null, [schema.node('paragraph', null, [schema.text('Hello')])]);
    expect(normalizeMarkdownDocument(doc)).toBe(doc);
  });

  it('turns an invalid root-level text node into a valid editable paragraph', () => {
    // nodeFromJSON deliberately does not validate the schema, just like a
    // malformed Markdown parse. Clicking into this tree throws contentMatchAt.
    const invalid = schema.nodeFromJSON({ type: 'doc', content: [{ type: 'text', text: 'Hello' }] });
    expect(() => invalid.check()).toThrow();
    const fixed = normalizeMarkdownDocument(invalid);
    expect(() => fixed.check()).not.toThrow();
    expect(fixed.firstChild?.type.name).toBe('paragraph');
    expect(fixed.textContent).toBe('Hello');
  });
});
