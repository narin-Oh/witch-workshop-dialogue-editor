import type { ReactNode, SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 20, children, ...rest }: P & { children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...rest}>
      {children}
    </svg>
  );
}

/* ---------- decorative motifs (aria-hidden, never interactive) ---------- */
export const Moon = (p: P) => <Svg {...p}><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" fill="currentColor" fillOpacity=".18" /></Svg>;
export const Star = (p: P) => <Svg {...p}><path d="m12 3 2.1 5.4 5.9.4-4.5 3.7 1.4 5.7L12 15.1 7.1 18.2l1.4-5.7L4 8.8l5.9-.4z" fill="currentColor" fillOpacity=".18" /></Svg>;
export const Sparkle = (p: P) => <Svg {...p}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.2 2.2M15.5 15.5l2.2 2.2M17.7 6.3l-2.2 2.2M8.5 15.5l-2.2 2.2" /></Svg>;
export const Leaf = (p: P) => <Svg {...p}><path d="M5 19c0-9 5-14 15-14 0 9-5 14-13 14" fill="currentColor" fillOpacity=".15" /><path d="M5 19c3-5 6-8 11-10" /></Svg>;
export const Ribbon = (p: P) => <Svg {...p}><path d="M7 3h10v18l-5-4-5 4z" fill="currentColor" fillOpacity=".18" /></Svg>;
export const Potion = (p: P) => <Svg {...p}><path d="M9.5 3h5M10.5 3v5L5.6 17.2A2.5 2.5 0 0 0 7.8 21h8.4a2.5 2.5 0 0 0 2.2-3.8L13.5 8V3" /><path d="M7.5 15.5h9" fill="currentColor" /></Svg>;
export const Scroll = (p: P) => <Svg {...p}><path d="M8 4h10a2 2 0 0 1 2 2v1H10M8 4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-1" /><path d="M10 11h6M10 15h4" /></Svg>;

/** Logo mark: a crescent moon cradling a star. */
export function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <circle cx="16" cy="16" r="15" fill="rgb(var(--c-primary-soft))" stroke="rgb(var(--c-primary))" strokeWidth="1.5" />
      <path d="M21.5 20.5A8 8 0 0 1 12 8.6a8 8 0 1 0 9.5 11.9z" fill="rgb(var(--c-primary-deep))" />
      <path d="m22 8 .9 2.3 2.4.2-1.9 1.5.6 2.3-2-1.3-2 1.3.6-2.3-1.9-1.5 2.4-.2z" fill="rgb(var(--c-yellow-deep))" />
    </svg>
  );
}

/** A thin divider with a tiny star in the middle. */
export function StarDivider() {
  return (
    <div className="my-3 flex items-center gap-2 text-primary-deep/50" aria-hidden="true">
      <span className="h-px flex-1 bg-line" />
      <Star size={12} />
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

/* ---------- functional icons ---------- */
export const IconPlay = (p: P) => <Svg {...p}><path d="M8 5.5v13l11-6.5z" fill="currentColor" fillOpacity=".25" /></Svg>;
export const IconSave = (p: P) => <Svg {...p}><path d="M5 4h11l3 3v13H5z" /><path d="M8 4v5h7V4M8 20v-6h8v6" /></Svg>;
export const IconOpen = (p: P) => <Svg {...p}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></Svg>;
export const IconExport = (p: P) => <Svg {...p}><path d="M12 15V4M8 8l4-4 4 4M5 14v5h14v-5" /></Svg>;
export const IconUndo = (p: P) => <Svg {...p}><path d="M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3" /></Svg>;
export const IconRedo = (p: P) => <Svg {...p}><path d="m15 14 5-5-5-5M20 9H10a6 6 0 0 0 0 12h3" /></Svg>;
export const IconPlus = (p: P) => <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>;
export const IconTrash = (p: P) => <Svg {...p}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></Svg>;
export const IconCopy = (p: P) => <Svg {...p}><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></Svg>;
export const IconUp = (p: P) => <Svg {...p}><path d="m6 15 6-6 6 6" /></Svg>;
export const IconDown = (p: P) => <Svg {...p}><path d="m6 9 6 6 6-6" /></Svg>;
export const IconWarn = (p: P) => <Svg {...p}><path d="M12 4 2.8 19.5h18.4z" /><path d="M12 10v4.5M12 17.2v.1" /></Svg>;
export const IconError = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="m9 9 6 6M15 9l-6 6" /></Svg>;
export const IconCheck = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="m8 12.5 3 3 5-6" /></Svg>;
export const IconBack = (p: P) => <Svg {...p}><path d="M15 6l-6 6 6 6" /></Svg>;
export const IconRestart = (p: P) => <Svg {...p}><path d="M4 12a8 8 0 1 0 3-6.2M4 4v4h4" /></Svg>;
export const IconClose = (p: P) => <Svg {...p}><path d="m6 6 12 12M18 6 6 18" /></Svg>;
export const IconBookmark = Ribbon;

/* ---------- node type icons ---------- */
export const IconStart = (p: P) => <Svg {...p}><path d="m12 3 2.1 5.4 5.9.4-4.5 3.7 1.4 5.7L12 15.1 7.1 18.2l1.4-5.7L4 8.8l5.9-.4z" /></Svg>;
export const IconDialogue = (p: P) => <Svg {...p}><path d="M4 5h16v11H9l-5 4z" /><path d="M8 9.5h8M8 12.5h5" /></Svg>;
export const IconChoice = (p: P) => <Svg {...p}><path d="M12 4v6M12 10l-6 5v5M12 10l6 5v5" /></Svg>;
export const IconCondition = (p: P) => <Svg {...p}><path d="M12 3 21 12l-9 9-9-9z" /><path d="M9.5 12.2l2 2 3.5-4" /></Svg>;
export const IconVariable = (p: P) => <Svg {...p}><path d="M7 4C5 4 5 6 5 8v2c0 1-1 2-2 2 1 0 2 1 2 2v2c0 2 0 4 2 4M17 4c2 0 2 2 2 4v2c0 1 1 2 2 2-1 0-2 1-2 2v2c0 2 0 4-2 4" /><path d="M10 9l4 6M14 9l-4 6" /></Svg>;
export const IconEvent = (p: P) => <Svg {...p}><path d="M13 3 5 13.5h6L10 21l8-10.5h-6z" /></Svg>;
export const IconEnd = (p: P) => <Svg {...p}><path d="M6 21V4M6 5h11l-2 3.5L17 12H6" /></Svg>;
