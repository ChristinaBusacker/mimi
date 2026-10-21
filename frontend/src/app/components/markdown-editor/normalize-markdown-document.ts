import { DOMParser, DOMSerializer } from '@tiptap/pm/model';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';

/** Repair an invalid Markdown parse only when ProseMirror schema validation fails.
 * Parsing the serialized DOM also preserves supported marks and image metadata.
 * On valid documents, return the same instance and leave undo history intact.
 */
export function normalizeMarkdownDocument(doc: ProseMirrorNode): ProseMirrorNode {
  try {
    doc.check();
    return doc;
  } catch {
    const element = document.createElement('div');
    const serializer = DOMSerializer.fromSchema(doc.type.schema);
    element.appendChild(serializer.serializeFragment(doc.content));
    const repaired = DOMParser.fromSchema(doc.type.schema).parse(element);
    repaired.check();
    return repaired;
  }
}
