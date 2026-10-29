import { describe, expect, it } from 'vitest';
import { appendVaryAccept, markdownPath, parseAccept, preferredType, STATIC_EXT } from './accept';

describe('parseAccept', () => {
  it('parses q-values and preserves order', () => {
    const entries = parseAccept('text/markdown, text/html;q=0.8, */*;q=0.1');
    expect(entries.map((e) => [e.type, e.q])).toEqual([
      ['text/markdown', 1],
      ['text/html', 0.8],
      ['*/*', 0.1],
    ]);
  });
});

describe('preferredType', () => {
  const produces = ['text/html', 'text/markdown'];

  it('defaults to HTML when Accept is missing', () => {
    expect(preferredType(null, produces)).toBe('text/html');
    expect(preferredType('', produces)).toBe('text/html');
  });

  it('selects markdown when it is preferred', () => {
    expect(preferredType('text/markdown', produces)).toBe('text/markdown');
    expect(preferredType('text/markdown, text/html;q=0.8', produces)).toBe('text/markdown');
  });

  it('selects HTML for typical browser Accept headers', () => {
    expect(
      preferredType('text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8', produces),
    ).toBe('text/html');
  });

  it('honors q=0 rejection over wildcards', () => {
    expect(preferredType('text/html;q=0, */*;q=1', produces)).toBe('text/markdown');
    expect(preferredType('text/markdown;q=0, text/html;q=0', produces)).toBe(null);
  });

  it('breaks ties by client order', () => {
    expect(preferredType('text/markdown, text/html', produces)).toBe('text/markdown');
    expect(preferredType('text/html, text/markdown', produces)).toBe('text/html');
  });
});

describe('markdownPath', () => {
  it('maps extensionless routes to index.md siblings', () => {
    expect(markdownPath('/')).toBe('/index.md');
    expect(markdownPath('/about')).toBe('/about/index.md');
    expect(markdownPath('/about/')).toBe('/about/index.md');
    expect(markdownPath('/contact/')).toBe('/contact/index.md');
  });
});

describe('appendVaryAccept', () => {
  it('adds Accept to Vary without duplicating', () => {
    const headers = new Headers({ Vary: 'Accept-Encoding' });
    appendVaryAccept(headers);
    expect(headers.get('Vary')).toBe('Accept-Encoding, Accept');
    appendVaryAccept(headers);
    expect(headers.get('Vary')).toBe('Accept-Encoding, Accept');
  });
});

describe('STATIC_EXT', () => {
  it('matches assets that should skip negotiation', () => {
    expect(STATIC_EXT.test('/assets/index-abc.css')).toBe(true);
    expect(STATIC_EXT.test('/llms.txt')).toBe(true);
    expect(STATIC_EXT.test('/sitemap.xml')).toBe(true);
    expect(STATIC_EXT.test('/about')).toBe(false);
    expect(STATIC_EXT.test('/')).toBe(false);
  });
});
