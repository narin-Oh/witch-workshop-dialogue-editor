/** Single source of truth for design tokens lives in src/index.css (CSS variables). */
const v = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;
const tone = (n) => ({ DEFAULT: v(n), soft: v(`${n}-soft`), deep: v(`${n}-deep`) });

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: v('bg'),
        panel: v('panel'),
        line: v('line'),
        text: { DEFAULT: v('text'), sub: v('text-sub') },
        primary: tone('primary'),
        mint: tone('mint'),
        pink: tone('pink'),
        blue: tone('blue'),
        yellow: tone('yellow'),
        peach: tone('peach'),
        mauve: tone('mauve'),
      },
      fontFamily: {
        sans: ['"Pretendard Variable"', 'Pretendard', '"Noto Sans KR"', '"Apple SD Gothic Neo"', '"Malgun Gothic"', 'system-ui', 'sans-serif'],
        serif: ['"Noto Serif KR"', '"Nanum Myeongjo"', 'Georgia', 'serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgb(92 83 112 / 0.06), 0 6px 18px rgb(92 83 112 / 0.08)',
        pop: '0 10px 40px rgb(92 83 112 / 0.18)',
      },
    },
  },
  plugins: [],
};
