export async function extractAndChunkPDF(file, onProgress) {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const totalPages = pdf.numPages;

  let fullText = '';
  for (let i = 1; i <= totalPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map(item => item.str).join(' ');
    fullText += `\n[Page ${i}] ${pageText}`;
    if (onProgress) {
      onProgress(Math.round((i / totalPages) * 40)); // 0-40% progress for PDF reading
    }
  }

  // Clean extra whitespace and split into ~1100 character overlapping chunks
  const cleaned = fullText.replace(/\s+/g, ' ').trim();
  const chunkSize = 1100;
  const overlap = 150;
  const chunks = [];

  for (let start = 0; start < cleaned.length; start += (chunkSize - overlap)) {
    const slice = cleaned.slice(start, start + chunkSize).trim();
    if (slice.length > 60) {
      chunks.push(slice);
    }
  }

  return chunks;
}
