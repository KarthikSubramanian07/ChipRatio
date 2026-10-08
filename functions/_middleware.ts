/**
 * Cloudflare Pages middleware: Markdown content negotiation + agent-friendly 404s.
 * Spec references: acceptmarkdown.com, RFC 9110 §12.5.1, llmstxt.org.
 */
import {
  appendVaryAccept,
  markdownPath,
  NOT_FOUND_MARKDOWN,
  preferredType,
  STATIC_EXT,
} from '../src/agent/accept';

type PagesContext = {
  request: Request;
  next: (input?: Request | string, init?: RequestInit) => Promise<Response>;
};

const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=(), interest-cohort=()',
  'Content-Security-Policy':
    "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
};

function applySecurity(headers: Headers): void {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    if (!headers.has(key)) headers.set(key, value);
  }
}

function markdownResponse(body: string, status: number): Response {
  const headers = new Headers({
    'Content-Type': 'text/markdown; charset=utf-8',
    'Cache-Control': 'public, max-age=0, must-revalidate',
  });
  appendVaryAccept(headers);
  applySecurity(headers);
  headers.set('Link', '</llms.txt>; rel="describedby", </sitemap.xml>; rel="describedby"');
  return new Response(body, { status, headers });
}

async function withNegotiationHeaders(
  response: Response,
  pathname: string,
  hasMarkdown: boolean,
): Promise<Response> {
  const headers = new Headers(response.headers);
  appendVaryAccept(headers);
  applySecurity(headers);

  const links: string[] = ['</llms.txt>; rel="describedby"'];
  if (hasMarkdown && (headers.get('content-type') || '').includes('text/html')) {
    links.unshift(`<${markdownPath(pathname)}>; rel="alternate"; type="text/markdown"`);
  }
  const existing = headers.get('Link');
  headers.set('Link', existing ? `${existing}, ${links.join(', ')}` : links.join(', '));

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export async function onRequest(context: PagesContext): Promise<Response> {
  const { request, next } = context;
  const url = new URL(request.url);

  if (STATIC_EXT.test(url.pathname) || url.pathname.startsWith('/assets/')) {
    return next();
  }

  const accept = request.headers.get('accept');
  const chosen = preferredType(accept, ['text/html', 'text/markdown']);

  if (chosen === null && accept) {
    const headers = new Headers({ 'Content-Type': 'text/plain; charset=utf-8' });
    appendVaryAccept(headers);
    applySecurity(headers);
    return new Response('Not Acceptable\n\nAvailable: text/html, text/markdown\n', {
      status: 406,
      headers,
    });
  }

  if (chosen === 'text/markdown') {
    const mdUrl = new URL(url);
    mdUrl.pathname = markdownPath(url.pathname);
    const mdRes = await next(new Request(mdUrl.toString(), request));
    const type = mdRes.headers.get('content-type') || '';
    // Pages may soft-serve HTML for missing assets in some environments - never label HTML as Markdown.
    if (mdRes.ok && !/html/i.test(type)) {
      const body = await mdRes.text();
      if (body.trim().length > 0) {
        return markdownResponse(body, 200);
      }
    }

    const probe = await next();
    if (probe.status === 404 || !probe.ok) {
      return markdownResponse(NOT_FOUND_MARKDOWN, 404);
    }

    if (!preferredType(accept, ['text/html'])) {
      const headers = new Headers({ 'Content-Type': 'text/plain; charset=utf-8' });
      appendVaryAccept(headers);
      applySecurity(headers);
      return new Response('Not Acceptable\n\nMarkdown unavailable and HTML is not acceptable.\n', {
        status: 406,
        headers,
      });
    }
  }

  const htmlRes = await next();

  if (htmlRes.status === 404) {
    if (
      chosen === 'text/markdown' ||
      preferredType(accept, ['text/markdown', 'text/html']) === 'text/markdown'
    ) {
      return markdownResponse(NOT_FOUND_MARKDOWN, 404);
    }
    return withNegotiationHeaders(htmlRes, url.pathname, false);
  }

  const mdUrl = new URL(url);
  mdUrl.pathname = markdownPath(url.pathname);
  const head = await next(new Request(mdUrl.toString(), { method: 'HEAD' }));
  const hasMarkdown = head.status === 200 && !/html/i.test(head.headers.get('content-type') || '');

  return withNegotiationHeaders(htmlRes, url.pathname, hasMarkdown);
}
