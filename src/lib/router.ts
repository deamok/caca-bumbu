import { useEffect, useState } from 'react';

export interface Location {
  path: string;
  query: URLSearchParams;
  raw: string;
}

function readLocation(): Location {
  const raw = window.location.hash.replace(/^#/, '') || '/';
  const [pathPart, queryPart = ''] = raw.split('?');
  const path = pathPart.startsWith('/') ? pathPart : `/${pathPart}`;
  return { path, query: new URLSearchParams(queryPart), raw };
}

export function useLocation(): Location {
  const [location, setLocation] = useState<Location>(() => readLocation());

  useEffect(() => {
    const onChange = () => setLocation(readLocation());
    window.addEventListener('hashchange', onChange);
    if (!window.location.hash) {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#/`);
    }
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  return location;
}

export function navigate(to: string, options: { replace?: boolean } = {}): void {
  const hash = to.startsWith('#') ? to : `#${to.startsWith('/') ? to : `/${to}`}`;
  if (options.replace) {
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${hash}`);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    return;
  }
  if (window.location.hash === hash) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  window.location.hash = hash;
}

export function useScrollTopOnNavigate(path: string): void {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
    const raf = window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'auto' }));
    return () => window.cancelAnimationFrame(raf);
  }, [path]);
}

export function pathStartsWith(path: string, prefix: string): boolean {
  if (prefix === '/') return path === '/';
  return path === prefix || path.startsWith(`${prefix}/`);
}

export function matchRoute(pattern: string, path: string): Record<string, string> | null {
  const patternParts = pattern.split('/').filter(Boolean);
  const pathParts = path.split('/').filter(Boolean);
  if (patternParts.length !== pathParts.length) return null;
  const params: Record<string, string> = {};
  for (let index = 0; index < patternParts.length; index += 1) {
    const part = patternParts[index];
    if (part.startsWith(':')) {
      params[part.slice(1)] = decodeURIComponent(pathParts[index]);
    } else if (part !== pathParts[index]) {
      return null;
    }
  }
  return params;
}
