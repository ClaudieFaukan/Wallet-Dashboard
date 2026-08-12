import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

interface PositionedItem {
  x: number;
  y: number;
  text: string;
}

/**
 * Reconstructs a PDF's text into left-to-right, top-to-bottom lines.
 * pdf.js only exposes per-glyph-run positions, not row/paragraph structure,
 * so rows are rebuilt by clustering text items whose y-coordinates are
 * within a small tolerance (glyphs on the same printed line can differ by a
 * pixel or two due to font metrics) and sorting each cluster by x.
 */
export async function extractPdfLines(buffer: Buffer): Promise<string[]> {
  const doc = await getDocument({ data: new Uint8Array(buffer), useSystemFonts: true }).promise;
  const lines: string[] = [];

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();

    const items: PositionedItem[] = [];
    for (const item of content.items) {
      if (!('str' in item) || item.str.trim() === '') continue;
      items.push({ x: item.transform[4], y: item.transform[5], text: item.str });
    }

    const rows: PositionedItem[][] = [];
    for (const item of items) {
      const row = rows.find((r) => Math.abs((r[0]?.y ?? 0) - item.y) <= 2);
      if (row) row.push(item);
      else rows.push([item]);
    }

    rows.sort((a, b) => (b[0]?.y ?? 0) - (a[0]?.y ?? 0));
    for (const row of rows) {
      row.sort((a, b) => a.x - b.x);
      lines.push(
        row
          .map((i) => i.text)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim(),
      );
    }
  }

  return lines;
}
