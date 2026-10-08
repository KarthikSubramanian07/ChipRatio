/** Shared chrome for static trust pages (about / contact / privacy / 404). */
import './styles/main.css';
import { applyTheme, nextTheme, themeLabel, THEMES } from './ui/themes';

const STORAGE_KEY = 'chipratio.v1';

function readStoredTheme(): string {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const theme = raw && JSON.parse(raw).theme;
    if (typeof theme === 'string' && THEMES.some((t) => t.id === theme)) return theme;
  } catch {
    // ignore malformed storage
  }
  return document.documentElement.dataset.theme || 'felt';
}

function persistTheme(theme: string): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const data = raw ? JSON.parse(raw) : {};
    data.theme = theme;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // private mode / quota - theme still applies for this session
  }
}

let current = readStoredTheme();
applyTheme(current);

const button = document.getElementById('theme-button');
const label = document.getElementById('theme-label');
if (label) label.textContent = themeLabel(current);

button?.addEventListener('click', () => {
  current = nextTheme(current);
  applyTheme(current);
  persistTheme(current);
  if (label) label.textContent = themeLabel(current);
});
