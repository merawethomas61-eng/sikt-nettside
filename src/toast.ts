type ToastType = 'info' | 'success' | 'error' | 'warning';

const ICONS: Record<ToastType, string> = {
  info: 'ℹ',
  success: '✓',
  error: '✕',
  warning: '⚠',
};

let container: HTMLDivElement | null = null;

function getContainer(): HTMLDivElement | null {
  if (typeof document === 'undefined') return null;
  if (container && document.body.contains(container)) return container;
  container = document.createElement('div');
  container.id = 'sikt-toast-container';
  document.body.appendChild(container);
  return container;
}

export function toast(message: string, type: ToastType = 'info', durationMs = 4000): void {
  const root = getContainer();
  if (!root) {
    // SSR-fallback: i verste fall, logg til konsoll
    // eslint-disable-next-line no-console
    console.warn(`[toast:${type}]`, message);
    return;
  }

  const el = document.createElement('div');
  el.className = `sikt-toast ${type}`;
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');

  const icon = document.createElement('span');
  icon.textContent = ICONS[type];
  icon.style.fontWeight = '700';
  icon.style.flexShrink = '0';
  el.appendChild(icon);

  const text = document.createElement('span');
  text.textContent = message;
  el.appendChild(text);

  root.appendChild(el);

  const remove = () => {
    el.classList.add('out');
    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 220);
  };

  el.addEventListener('click', remove);
  setTimeout(remove, durationMs);
}

// Korte hjelpere for lesbar call-site
export const toastInfo = (msg: string) => toast(msg, 'info');
export const toastSuccess = (msg: string) => toast(msg, 'success');
export const toastError = (msg: string) => toast(msg, 'error', 6000);
export const toastWarning = (msg: string) => toast(msg, 'warning');
