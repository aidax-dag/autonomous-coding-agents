import { promises as fs } from 'node:fs';
import path from 'node:path';

interface DocEntry {
  file: string;
  section: string;
  title: string;
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
  entries: DocEntry[];
}

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
  'guide',
  'docs',
  'document',
  'readme',
]);

function parseArgs(argv: string[]): { options: Record<string, string>; positional: string[] } {
  const options: Record<string, string> = {};
  const positional: string[] = [];

  for (let i = 0; i < argv.length; i += 1) {
    const part = argv[i];
    if (!part.startsWith('--')) {
      positional.push(part);
      continue;
    }

    const withoutPrefix = part.slice(2);
    const eqIdx = withoutPrefix.indexOf('=');
    if (eqIdx >= 0) {
      options[withoutPrefix.slice(0, eqIdx)] = withoutPrefix.slice(eqIdx + 1);
      continue;
    }

    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      options[withoutPrefix] = next;
      i += 1;
      continue;
    }

    options[withoutPrefix] = 'true';
  }

  return { options, positional };
}

function tokenize(text: string): string[] {
  const tokens = text.toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}_-]{1,}/gu) ?? [];
  return tokens.filter((token) => !STOP_WORDS.has(token));
}

function scoreEntry(entry: DocEntry, query: string, queryTokens: string[]): number {
  const lowerQuery = query.toLowerCase();
  const title = entry.title.toLowerCase();
  const file = entry.file.toLowerCase();
  const synopsis = entry.synopsis.toLowerCase();
  const headings = entry.headings.join(' ').toLowerCase();
  const keywordSet = new Set(entry.keywords.map((k) => k.toLowerCase()));
  const titleTokens = new Set(tokenize(entry.title));
  const fileTokens = new Set(tokenize(entry.file.replace(/[./]/g, ' ')));
  const headingTokens = new Set(tokenize(headings));
  const synopsisTokens = new Set(tokenize(entry.synopsis));

  let score = 0;
  if (lowerQuery.length >= 3 && (title.includes(lowerQuery) || file.includes(lowerQuery) || synopsis.includes(lowerQuery))) {
    score += 20;
  }

  for (const token of queryTokens) {
    if (titleTokens.has(token)) score += 10;
    if (keywordSet.has(token)) score += 7;
    if (headingTokens.has(token)) score += 5;
    if (fileTokens.has(token)) score += 5;
    if (synopsisTokens.has(token)) score += 3;
  }

  return score;
}

function clamp(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...`;
}

function usage(): void {
  console.log('Usage: npm run docs:query -- "<query>" [--top 10] [--index docs/_compact/docs-index.json]');
}

async function main(): Promise<void> {
  const { options, positional } = parseArgs(process.argv.slice(2));
  const query = positional.join(' ').trim();
  if (!query) {
    usage();
    process.exit(1);
  }

  const top = Number.parseInt(options.top ?? '10', 10);
  const indexPath = path.resolve(process.cwd(), options.index ?? 'docs/_compact/docs-index.json');

  const raw = await fs.readFile(indexPath, 'utf8').catch(() => null);
  if (!raw) {
    console.error(`Compact index not found: ${indexPath}`);
    console.error('Run `npm run docs:compact` first.');
    process.exit(1);
  }

  const index = JSON.parse(raw) as DocsIndex;
  const queryTokens = tokenize(query);
  const scored = index.entries
    .map((entry) => ({ entry, score: scoreEntry(entry, query, queryTokens) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.entry.estimatedTokens - b.entry.estimatedTokens || a.entry.file.localeCompare(b.entry.file))
    .slice(0, Number.isNaN(top) ? 10 : top);

  if (scored.length === 0) {
    console.log(`No matches for query: "${query}"`);
    return;
  }

  console.log(`Query: "${query}"`);
  console.log(`Index generated at: ${index.generatedAt}`);
  console.log('');
  console.log('| Rank | File | Est. Tokens | Why it matched |');
  console.log('|---:|---|---:|---|');
  scored.forEach((row, idx) => {
    const reason = clamp(row.entry.synopsis.replace(/\|/g, '\\|'), 100);
    console.log(`| ${idx + 1} | \`${row.entry.file.replace(/\|/g, '\\|')}\` | ${row.entry.estimatedTokens} | ${reason} |`);
  });
  console.log('');
  console.log('Next: open the top 3-5 files only and focus on their relevant headings.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
