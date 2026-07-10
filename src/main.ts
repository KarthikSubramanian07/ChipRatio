import './styles/main.css';
import { Store } from './ui/state';
import { mountApp } from './ui/app';
import { applyTheme, nextTheme, themeLabel } from './ui/themes';
import { mustFind } from './ui/dom';

const store = new Store();
applyTheme(store.get().theme);

mountApp(mustFind<HTMLElement>('#calculator'), store);

// Header theme cycler.
const themeButton = mustFind<HTMLButtonElement>('#theme-button');
const themeLabelEl = mustFind<HTMLElement>('#theme-label');
themeLabelEl.textContent = themeLabel(store.get().theme);
themeButton.addEventListener('click', () => {
  const next = nextTheme(store.get().theme);
  store.update({ theme: next });
  applyTheme(next);
  themeLabelEl.textContent = themeLabel(next);
});
