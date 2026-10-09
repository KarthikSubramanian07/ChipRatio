import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { NOT_FOUND_MARKDOWN } from './accept';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));

function read(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8');
}

function visibleTextLength(html: string): number {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim().length;
}

describe('agent-facing content', () => {
  it('ships llms.txt with when-to-use guidance and agent instructions', () => {
    const llms = read('public/llms.txt');
    expect(llms.startsWith('# ChipRatio')).toBe(true);
    expect(llms).toMatch(/## When to use this/);
    expect(llms).toMatch(/## Instructions for agents/);
    expect(llms.length).toBeGreaterThan(100);
    expect(llms).toContain('https://chipratio.pages.dev/');
    expect(llms).toContain('[About](https://chipratio.pages.dev/about/)');
  });

  it('publishes trust pages with at least 500 characters of visible content', () => {
    for (const page of ['about', 'contact', 'privacy']) {
      const html = read(`${page}/index.html`);
      expect(visibleTextLength(html)).toBeGreaterThanOrEqual(500);
      const md = read(`public/${page}/index.md`);
      expect(md.length).toBeGreaterThanOrEqual(500);
    }
  });

  it('includes Organization JSON-LD with contactPoint and address', () => {
    const html = read('index.html');
    expect(html).toContain('"@type": "Organization"');
    expect(html).toContain('"contactPoint"');
    expect(html).toContain('"contactType": "customer support"');
    expect(html).toContain('"@type": "PostalAddress"');
    // No personal email is published anywhere on the site.
    expect(html).not.toMatch(/@gmail\.com/);
  });

  it('puts the brand and product phrase in the homepage title and H1', () => {
    const html = read('index.html');
    expect(html).toMatch(/<title>[^<]*ChipRatio Chip Calculator/i);
    expect(html).toMatch(/<h1>[^<]*ChipRatio chip calculator/i);
  });

  it('provides homepage Markdown and a Markdown 404 body over 20 characters', () => {
    const home = read('public/index.md');
    expect(home.length).toBeGreaterThan(20);
    expect(home).toMatch(/^# ChipRatio/);
    expect(NOT_FOUND_MARKDOWN.length).toBeGreaterThan(20);
    expect(NOT_FOUND_MARKDOWN).toContain('/llms.txt');
    expect(NOT_FOUND_MARKDOWN).toContain('/sitemap.xml');
    expect(read('public/404.md')).toContain('/llms.txt');
  });

  it('lists trust pages in the sitemap', () => {
    const sitemap = read('public/sitemap.xml');
    expect(sitemap).toContain('https://chipratio.pages.dev/about/');
    expect(sitemap).toContain('https://chipratio.pages.dev/contact/');
    expect(sitemap).toContain('https://chipratio.pages.dev/privacy/');
    expect(sitemap).toContain('https://chipratio.pages.dev/llms.txt');
  });

  it('includes a top-level 404.html so Pages returns a real 404 status', () => {
    const html = read('404.html');
    expect(html).toMatch(/Page not found/i);
    expect(html).toContain('/llms.txt');
  });
});
