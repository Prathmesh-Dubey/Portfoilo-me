// Copies the pdf.js worker into /public so the admin resume preview can load it (runs on npm install).
import { copyFileSync, existsSync } from 'node:fs';

const src = 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs';
if (existsSync(src)) copyFileSync(src, 'public/pdf.worker.min.mjs');
