// Applies the saved (or OS-preferred) theme before the stylesheet loads, so a returning
// visitor on Midnight/Rose/Neon never sees a flash of the default Felt green. Loaded as a
// plain same-origin script (not inline) so it runs under a strict script-src 'self' CSP.
// Mirrors the equivalent logic in src/ui/themes.ts, which the JS module applies later;
// this copy exists only because it must run synchronously before first paint.
(function () {
  try {
    var stored = localStorage.getItem('chipratio.v1');
    var theme = stored && JSON.parse(stored).theme;
    var known = ['felt', 'midnight', 'ivory', 'rose', 'neon'];
    if (typeof theme === 'string' && known.indexOf(theme) !== -1) {
      document.documentElement.dataset.theme = theme;
    } else if (matchMedia('(prefers-color-scheme: light)').matches) {
      document.documentElement.dataset.theme = 'ivory';
    }
  } catch (e) {
    // Malformed storage: fall through to the default Felt theme already on <html>.
  }
})();
