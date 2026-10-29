/** RFC 9110 Accept parsing for HTML vs Markdown content negotiation. */

export type AcceptEntry = { type: string; q: number; specificity: number };

export function parseAccept(header: string): AcceptEntry[] {
  return header
    .split(',')
    .map((raw) => {
      const parts = raw
        .trim()
        .split(';')
        .map((s) => s.trim());
      const type = parts[0]?.toLowerCase();
      if (!type) return null;
      let q = 1;
      for (const param of parts.slice(1)) {
        const [name, value] = param.split('=').map((s) => s.trim());
        if (name === 'q') {
          const parsed = Number(value);
          if (!Number.isNaN(parsed)) q = Math.max(0, Math.min(1, parsed));
        }
      }
      const specificity = type === '*/*' ? 0 : type.endsWith('/*') ? 1 : 2;
      return { type, q, specificity };
    })
    .filter((e): e is AcceptEntry => e !== null);
}

function matches(entry: AcceptEntry, candidate: string): boolean {
  if (entry.type === '*/*') return true;
  if (entry.type.endsWith('/*')) return candidate.startsWith(entry.type.slice(0, -1));
  return entry.type === candidate;
}

/**
 * Pick the best representation from `produces` for an Accept header.
 * Missing/empty Accept → first produces entry (HTML-first callers pass html first).
 */
export function preferredType(header: string | null, produces: string[]): string | null {
  if (!header || header.trim() === '') return produces[0] ?? null;
  const entries = parseAccept(header);
  if (entries.length === 0) return produces[0] ?? null;

  let bestType: string | null = null;
  let bestQ = -1;
  let bestPosition = Infinity;

  for (const candidate of produces) {
    let matched: AcceptEntry | null = null;
    let matchedPosition = Infinity;
    for (let idx = 0; idx < entries.length; idx++) {
      const e = entries[idx];
      if (!matches(e, candidate)) continue;
      if (
        matched === null ||
        e.specificity > matched.specificity ||
        (e.specificity === matched.specificity && idx < matchedPosition)
      ) {
        matched = e;
        matchedPosition = idx;
      }
    }
    if (matched === null) continue;
    if (matched.q <= 0) continue;

    if (matched.q > bestQ || (matched.q === bestQ && matchedPosition < bestPosition)) {
      bestQ = matched.q;
      bestPosition = matchedPosition;
      bestType = candidate;
    }
  }

  return bestType;
}

export function appendVaryAccept(headers: Headers): void {
  const existing = headers.get('vary');
  if (!existing) {
    headers.set('Vary', 'Accept');
    return;
  }
  const tokens = existing.split(',').map((s) => s.trim().toLowerCase());
  if (!tokens.includes('accept')) {
    headers.set('Vary', `${existing}, Accept`);
  }
}

/** Map a request pathname to its Markdown sibling asset path. */
export function markdownPath(pathname: string): string {
  const clean = pathname.replace(/\/$/, '') || '/';
  if (clean === '/') return '/index.md';
  if (clean === '/404') return '/404.md';
  return `${clean}/index.md`;
}

// `.md` is included so direct asset fetches bypass negotiation (siblings are already Markdown).
export const STATIC_EXT =
  /\.(?:css|js|mjs|map|png|jpe?g|webp|gif|svg|avif|ico|woff2?|ttf|otf|eot|xml|txt|md|json|pdf|mp4|webm|mp3|wav|ogg|zip|webmanifest)$/i;

export const NOT_FOUND_MARKDOWN = `# Page not found

This path does not exist on ChipRatio.

Try these instead:

- [Home](/) - ChipRatio poker chip calculator
- [About](/about/) - what ChipRatio is
- [Contact](/contact/) - how to reach the project
- [Privacy](/privacy/) - what data stays on your device
- [llms.txt](/llms.txt) - agent index and when-to-use guidance
- [Sitemap](/sitemap.xml) - every public URL

ChipRatio is a free poker chip calculator for home games at https://chipratio.pages.dev/
`;
