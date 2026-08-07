import { theme, type ThemeConfig } from "antd";

// Own indigo/blue rather than antd's stock #1677ff (used by nearly every
// unstyled antd app) — same color family, so nothing about the app's feel
// changes abruptly, just no longer visually generic. Works unchanged on
// both light and dark backgrounds, so it isn't part of the light/dark
// split below.
export const COLOR_PRIMARY = "#3B5BDB";

// antd's own default — matches exactly since antd applies this per-component
// via CSS-in-JS rather than a global body rule, so anything rendered outside
// an antd component (react-hot-toast's portal, for one) needs it spelled out
// explicitly to not fall back to the browser's default serif font. Keep in
// sync with index.html's global `html, body` rule, which covers the same
// gap for plain elements that don't read this constant at all.
export const FONT_FAMILY = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji'`;

// Called from main.tsx once the saved dark-mode preference (see
// utils/settings.ts's darkMode key) is known — switches antd's own
// component palette (Button, Input, Modal, Select, ...) via its algorithm,
// the other half of the picture from index.html's `--bg`/`--border`/etc.
// CSS vars, which cover this app's own plain (non-antd) elements.
export function getThemeConfig(dark: boolean): ThemeConfig {
  return {
    algorithm: dark ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: {
      colorPrimary: COLOR_PRIMARY,
      fontFamily: FONT_FAMILY,
    },
  };
}

// Non-antd style constants reused by hand across components that fall
// outside antd's own token system (plain <div>/<span> inline styles).
// borderColorLight reads the CSS var set on :root by index.html (flipped
// dark/light by main.tsx's data-theme attribute) rather than a literal
// hex, so every consumer stays correct across both themes without each one
// needing to know which theme is active.
export const styleTokens = {
  borderColorLight: "var(--border)",
  secondaryFontSize: 12,
};
