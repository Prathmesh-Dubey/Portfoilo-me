'use client';

import { useEffect, useRef, useState } from 'react';

type PdfJs = typeof import('pdfjs-dist');

// One pdf.js module + one worker for the whole page: starting a worker is slow, so it is reused between renders.
let pdfjsPromise: Promise<{ pdfjs: PdfJs; worker: InstanceType<PdfJs['PDFWorker']> }> | null = null;
function getPdfJs() {
  pdfjsPromise ??= import('pdfjs-dist').then((pdfjs) => {
    pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
    return { pdfjs, worker: new pdfjs.PDFWorker() };
  });
  return pdfjsPromise;
}

/**
 * Draws the real PDF bytes page-by-page with pdf.js. Unlike an <iframe>, this works in every browser
 * (including phones and embedded webviews) and shows page boundaries, so a spill onto page 2 is obvious.
 */
export function PdfPreview({ bytes }: { bytes: ArrayBuffer | null }) {
  const host = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let t: ReturnType<typeof setTimeout>;
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.floor(entry.contentRect.width);
      clearTimeout(t);
      // ignore tiny changes (e.g. a scrollbar appearing) so they don't restart rendering
      t = setTimeout(() => setWidth((prev) => (Math.abs(prev - w) > 24 ? w : prev)), 120);
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      clearTimeout(t);
    };
  }, []);

  useEffect(() => {
    const el = host.current;
    // Measure directly if the ResizeObserver hasn't reported yet (some embedded browsers delay it).
    const available = width || (el ? el.clientWidth - 32 : 0);
    if (!el || !bytes || available <= 0) return;
    let cancelled = false;
    let task: ReturnType<PdfJs['getDocument']> | null = null;
    el.dataset.status = 'loading';

    (async () => {
      try {
        const { pdfjs, worker } = await getPdfJs();
        if (cancelled) return;
        task = pdfjs.getDocument({ data: new Uint8Array(bytes.slice(0)), worker });
        const doc = await task.promise;
        const canvases: HTMLCanvasElement[] = [];
        const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
        const target = Math.min(available - 32, 860);

        for (let n = 1; n <= doc.numPages; n++) {
          if (cancelled) return;
          const page = await doc.getPage(n);
          const base = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({ scale: (target / base.width) * dpr });
          const canvas = document.createElement('canvas');
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.style.width = `${Math.floor(viewport.width / dpr)}px`;
          canvas.className = 'pdf-page';
          canvas.setAttribute('aria-label', `Page ${n} of ${doc.numPages}`);
          await page.render({ canvas, viewport }).promise;
          canvases.push(canvas);
        }
        if (cancelled) return;
        el.replaceChildren(...canvases);
        el.dataset.status = 'done';
        setError('');
      } catch (e) {
        if (!cancelled) {
          el.dataset.status = 'error';
          setError((e as Error).message || 'Preview failed');
        }
      } finally {
        task?.destroy();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [bytes, width]);

  return (
    <>
      <div ref={host} className="pdf-pages" />
      {error && <div className="studio-empty">Preview failed: {error}. Use “Open” to view the PDF.</div>}
    </>
  );
}
