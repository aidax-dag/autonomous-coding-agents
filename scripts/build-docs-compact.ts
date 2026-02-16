import { promises as fs } from 'node:fs';
import path from 'node:path';

type SupportedExt = '.md' | '.markdown' | '.yaml' | '.yml';

interface DocEntry {
  file: string;
  section: string;
  ext: SupportedExt;
  title: string;
  lines: number;
  bytes: number;
  estimatedTokens: number;
  headings: string[];
  synopsis: string;
  keywords: string[];
}

interface DocsIndex {
  generatedAt: string;
  sourceDir: string;
  totals: {
    docs: number;
    bytes: number;
    lines: number;
    estimatedTokens: number;
  };
  sections: Array<{
    name: string;
    docs: number;
    bytes: number;
    estimatedTokens: number;
  }>;
  entries: DocEntry[];
}

const SUPPORTED_EXTENSIONS = new Set<SupportedExt>(['.md', '.markdown', '.yaml', '.yml']);
const STOP_WORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'from',
  'into',
  'that',
  'this',
  'these',
  'those',
  'about',
  'your',
  'you',
  'are',
  'was',
  'were',
  'how',
  'when',
  'where',
  'what',
  'why',
  'can',
  'will',
  'use',
  'using',
  'used',
  'guide',
  'readme',
  'docs',
  'document',
  'documentation',
  'project',
  'overview',
  'setup',
  'configuration',
  'spec',
  'specification',
  'implementation',
  'roadmap',
  'task',
  'tasks',
]);

function parseArgs(argv: string[]): Record<string, string> {
  const parsed: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const part = argv[i];
    if (!part.startsWith('--')) {
      continue;
    }
    const withoutPrefix = part.slice(2);
    const eqIdx = withoutPrefix.indexOf('=');
    if (eqIdx >= 0) {
      parsed[withoutPrefix.slice(0, eqIdx)] = withoutPrefix.slice(eqIdx + 1);
      continue;
    }
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      parsed[withoutPrefix] = next;
      i += 1;
      continue;
    }
    parsed[withoutPrefix] = 'true';
  }
  return parsed;
}

function toPosixPath(input: string): string {
  return input.split(path.sep).join('/');
}

function clampText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...`;
}

function normalizeLine(line: string): string {
  return line
    .replace(/`+/g, '')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/#+\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractMarkdownHeadings(content: string, maxHeadings: number): string[] {
  const headings: string[] = [];
  const regex = /^#{1,6}\s+(.+?)\s*$/gm;
  for (const match of content.matchAll(regex)) {
    const cleaned = normalizeLine(match[1] ?? '');
    if (!cleaned) {
      continue;
    }
    headings.push(cleaned);
    if (headings.length >= maxHeadings) {
      break;
    }
  }
  return headings;
}

function extractMarkdownTitle(content: string, fallback: string): string {
  const titleMatch = content.match(/^#\s+(.+?)\s*$/m);
  if (!titleMatch) {
    return fallback;
  }
  return normalizeLine(titleMatch[1] ?? fallback) || fallback;
}

function stripFrontMatter(content: string): string {
  return content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');
}

function extractMarkdownSynopsis(content: string, maxLength: number): string {
  const body = stripFrontMatter(content)
    .replace(/```[\s\S]*?```/g, '\n')
    .replace(/^#{1,6}\s+.*$/gm, '\n')
    .replace(/^\s*\|[-|:\s]+\|\s*$/gm, '\n');

  const paragraphs = body
    .split(/\n\s*\n/g)
    .map((p) => normalizeLine(p))
    .filter((p) => p.length >= 24 && !p.startsWith('|'));

  if (paragraphs.length === 0) {
    const firstLine = body
      .split(/\r?\n/g)
      .map((line) => normalizeLine(line))
      .find((line) => line.length >= 12);
    return firstLine ? clampText(firstLine, maxLength) : 'No summary available.';
  }

  return clampText(paragraphs[0], maxLength);
}

function extractYamlTitle(fileName: string): string {
  return path.basename(fileName).replace(/\.[^.]+$/, '');
}

function extractYamlKeys(content: string, maxKeys: number): string[] {
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const match of content.matchAll(/^\s*([A-Za-z0-9_-]+)\s*:/gm)) {
    const key = (match[1] ?? '').trim();
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    keys.push(key);
    if (keys.length >= maxKeys) {
      break;
    }
  }
  return keys;
}

function extractYamlSynopsis(content: string, maxLength: number): string {
  const keys = extractYamlKeys(content, 10);
  if (keys.length === 0) {
    return 'YAML document.';
  }
  return clampText(`YAML definition with keys: ${keys.join(', ')}`, maxLength);
}

function tokenize(text: string): string[] {
  const tokens = text.toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}_-]{1,}/gu) ?? [];
  return tokens.filter((token) => !STOP_WORDS.has(token));
}

function extractKeywords(parts: string[], maxKeywords: number): string[] {
  const frequency = new Map<string, number>();
  for (const part of parts) {
    for (const token of tokenize(part)) {
      frequency.set(token, (frequency.get(token) ?? 0) + 1);
    }
  }

  return Array.from(frequency.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, maxKeywords)
    .map(([word]) => word);
}

function estimateTokensFromBytes(bytes: number): number {
  return Math.max(1, Math.ceil(bytes / 4));
}

function escapeMdCell(text: string): string {
  return text.replace(/\|/g, '\\|');
}

async function collectFiles(rootDir: string): Promise<string[]> {
  const files: string[] = [];

  async function walk(currentDir: string): Promise<void> {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === '_compact' || entry.name === '.git' || entry.name === 'node_modules') {
        continue;
      }

      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }

      const ext = path.extname(entry.name).toLowerCase() as SupportedExt;
      if (SUPPORTED_EXTENSIONS.has(ext)) {
        files.push(fullPath);
      }
    }
  }

  await walk(rootDir);
  return files;
}

function buildSectionStats(entries: DocEntry[]): DocsIndex['sections'] {
  const bySection = new Map<string, { docs: number; bytes: number; estimatedTokens: number }>();
  for (const entry of entries) {
    const section = bySection.get(entry.section) ?? { docs: 0, bytes: 0, estimatedTokens: 0 };
    section.docs += 1;
    section.bytes += entry.bytes;
    section.estimatedTokens += entry.estimatedTokens;
    bySection.set(entry.section, section);
  }

  return Array.from(bySection.entries())
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((a, b) => b.bytes - a.bytes || a.name.localeCompare(b.name));
}

function renderMarkdown(index: DocsIndex, topN: number): string {
  const largest = [...index.entries].sort((a, b) => b.bytes - a.bytes).slice(0, topN);
  const allDocs = [...index.entries].sort(
    (a, b) => a.section.localeCompare(b.section) || b.estimatedTokens - a.estimatedTokens || a.file.localeCompare(b.file),
  );

  const lines: string[] = [];
  lines.push('# Docs Compact Index');
  lines.push('');
  lines.push(`- Generated: ${index.generatedAt}`);
  lines.push(`- Source: \`${index.sourceDir}\``);
  lines.push(`- Total docs: **${index.totals.docs}**`);
  lines.push(`- Total size: **${(index.totals.bytes / 1024).toFixed(1)} KB**`);
  lines.push(`- Estimated full-context cost: **~${index.totals.estimatedTokens.toLocaleString()} tokens**`);
  lines.push('');
  lines.push('## Token-Efficient Workflow');
  lines.push('');
  lines.push('1. Read this file first, not the entire docs tree.');
  lines.push('2. Use `npm run docs:query -- "<topic>"` to shortlist relevant files.');
  lines.push('3. Open only the top 3-5 files and only the headings you need.');
  lines.push('4. Skip `docs/api/openapi.yaml` unless you are doing API/schema tasks.');
  lines.push('');
  lines.push('## Largest Documents');
  lines.push('');
  lines.push('| File | Size (KB) | Est. Tokens | Lines |');
  lines.push('|---|---:|---:|---:|');
  for (const doc of largest) {
    lines.push(
      `| \`${escapeMdCell(doc.file)}\` | ${(doc.bytes / 1024).toFixed(1)} | ${doc.estimatedTokens.toLocaleString()} | ${doc.lines.toLocaleString()} |`,
    );
  }
  lines.push('');
  lines.push('## Sections');
  lines.push('');
  lines.push('| Section | Files | Size (KB) | Est. Tokens |');
  lines.push('|---|---:|---:|---:|');
  for (const section of index.sections) {
    lines.push(
      `| \`${escapeMdCell(section.name)}\` | ${section.docs} | ${(section.bytes / 1024).toFixed(1)} | ${section.estimatedTokens.toLocaleString()} |`,
    );
  }
  lines.push('');
  lines.push('## All Documents (One-line Summary)');
  lines.push('');
  lines.push('| File | Est. Tokens | Summary |');
  lines.push('|---|---:|---|');
  for (const doc of allDocs) {
    const summary = escapeMdCell(clampText(doc.synopsis, 120));
    lines.push(`| \`${escapeMdCell(doc.file)}\` | ${doc.estimatedTokens.toLocaleString()} | ${summary} |`);
  }
  lines.push('');

  return lines.join('\n');
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const docsDir = path.resolve(process.cwd(), args.docs ?? 'docs');
  const outDir = path.resolve(process.cwd(), args.out ?? path.join(args.docs ?? 'docs', '_compact'));
  const topN = Number.parseInt(args.top ?? '20', 10);

  const docsStat = await fs.stat(docsDir).catch(() => null);
  if (!docsStat || !docsStat.isDirectory()) {
    throw new Error(`Docs directory not found: ${docsDir}`);
  }

  const files = await collectFiles(docsDir);
  const entries: DocEntry[] = [];

  for (const filePath of files) {
    const content = await fs.readFile(filePath, 'utf8');
    const bytes = Buffer.byteLength(content, 'utf8');
    const lines = content.split(/\r?\n/g).length;
    const estimatedTokens = estimateTokensFromBytes(bytes);
    const rel = toPosixPath(path.relative(docsDir, filePath));
    const section = rel.includes('/') ? rel.split('/')[0] : 'root';
    const ext = path.extname(filePath).toLowerCase() as SupportedExt;
    const fallbackTitle = path.basename(filePath).replace(/\.[^.]+$/, '');

    const title =
      ext === '.md' || ext === '.markdown' ? extractMarkdownTitle(content, fallbackTitle) : extractYamlTitle(filePath);
    const headings =
      ext === '.md' || ext === '.markdown'
        ? extractMarkdownHeadings(content, 8)
        : extractYamlKeys(content, 8).map((k) => `${k}:`);
    const synopsis =
      ext === '.md' || ext === '.markdown'
        ? extractMarkdownSynopsis(content, 220)
        : extractYamlSynopsis(content, 220);
    const keywords = extractKeywords([title, ...headings, synopsis, rel], 12);

    entries.push({
      file: rel,
      section,
      ext,
      title,
      lines,
      bytes,
      estimatedTokens,
      headings,
      synopsis,
      keywords,
    });
  }

  entries.sort((a, b) => a.file.localeCompare(b.file));

  const index: DocsIndex = {
    generatedAt: new Date().toISOString(),
    sourceDir: toPosixPath(path.relative(process.cwd(), docsDir)) || '.',
    totals: {
      docs: entries.length,
      bytes: entries.reduce((sum, entry) => sum + entry.bytes, 0),
      lines: entries.reduce((sum, entry) => sum + entry.lines, 0),
      estimatedTokens: entries.reduce((sum, entry) => sum + entry.estimatedTokens, 0),
    },
    sections: buildSectionStats(entries),
    entries,
  };

  await fs.mkdir(outDir, { recursive: true });

  const jsonPath = path.join(outDir, 'docs-index.json');
  const markdownPath = path.join(outDir, 'README.md');
  await fs.writeFile(jsonPath, `${JSON.stringify(index, null, 2)}\n`, 'utf8');
  await fs.writeFile(markdownPath, `${renderMarkdown(index, Number.isNaN(topN) ? 20 : topN)}\n`, 'utf8');

  const relativeJson = toPosixPath(path.relative(process.cwd(), jsonPath));
  const relativeMd = toPosixPath(path.relative(process.cwd(), markdownPath));
  console.log(`Generated compact docs index: ${relativeMd}`);
  console.log(`Generated machine index: ${relativeJson}`);
  console.log(`Docs: ${index.totals.docs}, size: ${(index.totals.bytes / 1024).toFixed(1)} KB, est tokens: ~${index.totals.estimatedTokens}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
