import { useCallback } from 'react';
import { create } from 'zustand';
import { DEFAULT_LANG, LANGS, translate, type Lang, type Params } from './translate';

export { translate, type Lang, type Params, type MessageRef } from './translate';

const STORAGE_KEY = 'witch-workshop:lang';

function loadLang(): Lang {
  try {
    const v = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (v && (LANGS as readonly string[]).includes(v)) return v as Lang;
  } catch {
    /* storage unavailable: fall back to default */
  }
  return DEFAULT_LANG;
}

interface LangState {
  lang: Lang;
  setLang: (l: Lang) => void;
}

/** Selected UI language, remembered in localStorage. Korean is the default. */
export const useLang = create<LangState>((set) => ({
  lang: loadLang(),
  setLang: (lang) => {
    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, lang);
    } catch {
      /* ignore */
    }
    if (typeof document !== 'undefined') document.documentElement.lang = lang;
    set({ lang });
  },
}));

export type TFunction = (key: string, params?: Params) => string;

/** React hook: returns a translator bound to the current language (re-renders on switch). */
export function useT(): TFunction {
  const lang = useLang((s) => s.lang);
  return useCallback((key, params) => translate(lang, key, params), [lang]);
}

/** Non-React translator for event handlers and store actions (reads the current language). */
export const getT = (): TFunction => {
  const { lang } = useLang.getState();
  return (key, params) => translate(lang, key, params);
};

if (typeof document !== 'undefined') document.documentElement.lang = useLang.getState().lang;
