import type { CSSProperties } from 'react';

const paths = {
  plus: 'M12 5v14M5 12h14',
  close: 'm6 6 12 12M18 6 6 18',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5',
  link: 'm10 13 4-4M8 15l-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0M16 9l1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0',
  check: 'm5 12 4 4L19 6',
  copy: 'M9 9h11v11H9zM15 5V2H2v13h3',
  arrow: 'M5 12h14m-5-5 5 5-5 5',
  info: 'M12 11v6M12 7v.1M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
  sparkle: 'm12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z',
  reset: 'M3 10a9 9 0 1 1 1 8M3 3v7h7',
  github: 'M9 19c-4 1-4-2-6-2m12 5v-4c0-1-.3-2-1-2 3-.4 6-1.5 6-6 0-1.2-.4-2.3-1.2-3.2.1-.8.1-2-.5-3-1.5 0-3 1-3.5 1a12 12 0 0 0-7 0C7 4 5.5 3 4 3c-.6 1-.6 2.2-.5 3A5 5 0 0 0 2.3 9c0 4.5 3 5.6 6 6-.7.5-1 1.5-1 2v5',
  download: 'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',
  upload: 'M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5',
};

export function Icon({ name, size = 18, style }: { name: keyof typeof paths; size?: number; style?: CSSProperties }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={style}><path d={paths[name]} /></svg>;
}

export function Logo() {
  return <svg width="38" height="38" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="16" fill="#e46544" /><g fill="none" stroke="#111a38" strokeWidth="3"><rect x="14" y="14" width="25" height="35" rx="4" transform="rotate(-12 26 32)" /><rect x="27" y="15" width="23" height="34" rx="4" fill="#e46544" /></g><path d="m38 24 4 7-4 7-4-7z" fill="#e6f7f7" /></svg>;
}
