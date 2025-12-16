/*
Generates a Word document that includes:
1) The overview from docs/mobile-app-overview.md
2) The full source code under app/ (tsx, ts, js, jsx, css)

Usage: node scripts/generate-docx.js
Output: docs/HealthConnect-Mobile-App.docx
*/

const fs = require('fs');
const path = require('path');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, PageBreak } = require('docx');
const fg = require('fast-glob');

const ROOT = path.resolve(__dirname, '..');
const DOCS_DIR = path.join(ROOT, 'docs');
const APP_DIR = path.join(ROOT, 'app');
const OVERVIEW_MD = path.join(DOCS_DIR, 'mobile-app-overview.md');
const OUTPUT_DOCX = path.join(DOCS_DIR, 'HealthConnect-Mobile-App.docx');

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function readText(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (e) {
    return null;
  }
}

function mdToParagraphs(mdText) {
  // Minimal Markdown-to-Paragraphs converter (headings + paragraphs + code fences preserved as plain text)
  const lines = mdText.split(/\r?\n/);
  const paras = [];
  let inCode = false;

  for (const line of lines) {
    if (line.startsWith('```')) {
      inCode = !inCode;
      paras.push(new Paragraph({
        children: [new TextRun({ text: line, font: 'Consolas' })],
      }));
      continue;
    }

    if (inCode) {
      paras.push(new Paragraph({ children: [new TextRun({ text: line, font: 'Consolas' })] }));
      continue;
    }

    if (line.startsWith('# ')) {
      paras.push(new Paragraph({ text: line.replace(/^#\s*/, ''), heading: HeadingLevel.HEADING_1 }));
    } else if (line.startsWith('## ')) {
      paras.push(new Paragraph({ text: line.replace(/^##\s*/, ''), heading: HeadingLevel.HEADING_2 }));
    } else if (line.startsWith('### ')) {
      paras.push(new Paragraph({ text: line.replace(/^###\s*/, ''), heading: HeadingLevel.HEADING_3 }));
    } else if (line.trim() === '') {
      paras.push(new Paragraph(''));
    } else {
      paras.push(new Paragraph({ children: [new TextRun(line)] }));
    }
  }
  return paras;
}

function codeToParagraphs(codeText) {
  // Render code as monospace TextRuns to preserve formatting
  const lines = codeText.split(/\r?\n/);
  const paras = lines.map((l) =>
    new Paragraph({
      children: [new TextRun({ text: l === '' ? ' ' : l, font: 'Consolas' })],
    })
  );
  return paras;
}

async function main() {
  ensureDir(DOCS_DIR);

  const sections = [];

  // Title Page
  const today = new Date().toLocaleString();
  sections.push({
    properties: {},
    children: [
      new Paragraph({ text: 'Health Connect Mobile App', heading: HeadingLevel.TITLE }),
      new Paragraph('Technical Package'),
      new Paragraph(`Generated: ${today}`),
      new Paragraph({ children: [new PageBreak()] }),
    ],
  });

  // Overview (Markdown)
  const overviewText = readText(OVERVIEW_MD) || '# Overview\n(Overview file not found)';
  const overviewParas = mdToParagraphs(overviewText);
  sections.push({ properties: {}, children: overviewParas.concat([new Paragraph({ children: [new PageBreak()] })]) });

  // Source Code (app/)
  sections.push({
    properties: {},
    children: [new Paragraph({ text: 'Source Code — app/', heading: HeadingLevel.HEADING_1 })],
  });

  const patterns = [
    path.join(APP_DIR, '**/*.tsx').replace(/\\/g, '/'),
    path.join(APP_DIR, '**/*.ts').replace(/\\/g, '/'),
    path.join(APP_DIR, '**/*.jsx').replace(/\\/g, '/'),
    path.join(APP_DIR, '**/*.js').replace(/\\/g, '/'),
    path.join(APP_DIR, '**/*.css').replace(/\\/g, '/'),
  ];

  const files = await fg(patterns, { dot: false, onlyFiles: true, followSymbolicLinks: true });
  files.sort();

  const codeChildren = [];
  for (const f of files) {
    const rel = path.relative(ROOT, f).split(path.sep).join('/');
    const content = readText(f) ?? '';
    codeChildren.push(new Paragraph({ text: rel, heading: HeadingLevel.HEADING_2 }));
    codeChildren.push(new Paragraph(''));
    codeChildren.push(...codeToParagraphs(content));
    codeChildren.push(new Paragraph({ children: [new PageBreak()] }));
  }

  sections.push({ properties: {}, children: codeChildren });

  const doc = new Document({
    creator: 'Health Connect Exporter',
    title: 'Health Connect Mobile App — Technical Package',
    description: 'Generated Word document with overview and app source code',
    sections,
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(OUTPUT_DOCX, buffer);
  console.log(`\n✅ Generated: ${OUTPUT_DOCX}\nFiles included: ${files.length}`);
}

main().catch((e) => {
  console.error('Failed to generate DOCX:', e);
  process.exit(1);
});
