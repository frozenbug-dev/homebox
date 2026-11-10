import { StyleSheet } from 'react-native-unistyles'

const spacing = (v: number) => v * 4

// Linear-inspired: quiet neutral greys, hairline separators, one indigo accent.
// Colour carries meaning only (tags, status, destructive), never decoration.

const type = {
  /** Screen and item titles inside content. */
  title: { fontSize: 22, fontWeight: '600', letterSpacing: -0.2 },
  /** Row titles, body copy. */
  body: { fontSize: 15, fontWeight: '400' },
  rowTitle: { fontSize: 15, fontWeight: '500' },
  /** Row subtitles, chip labels. */
  meta: { fontSize: 13, fontWeight: '400' },
  /** Group headers ("Sub-places", "Details"). */
  label: { fontSize: 12, fontWeight: '600', letterSpacing: 0.2 },
} as const

const lightTheme = {
  colors: {
    background: '#fcfcfd',
    surface: '#f3f3f5',
    surfaceSelected: '#e8e8ec',
    elevated: '#ffffff',
    /** Menus and popovers. */
    menu: '#ffffff',
    text: '#1b1b1f',
    textMuted: '#6b6f76',
    textFaint: '#a0a3aa',
    primary: '#5e6ad2',
    onPrimary: '#ffffff',
    primarySoft: 'rgba(94, 106, 210, 0.12)',
    primaryContainer: '#e0e2fa',
    onPrimaryContainer: '#1f2775',
    danger: '#d93036',
    success: '#2e9e5b',
    separator: 'rgba(0, 0, 0, 0.08)',
    border: 'rgba(0, 0, 0, 0.1)',
    inputBackground: '#f3f3f5',
    placeholder: '#a0a3aa',
    ripple: 'rgba(0, 0, 0, 0.08)',
    scrim: 'rgba(0, 0, 0, 0.4)',
  },
  type,
  spacing,
  radius: { sm: 6, md: 10, lg: 14, pill: 999 },
} as const

const darkTheme = {
  colors: {
    background: '#0f1011',
    surface: '#18191b',
    surfaceSelected: '#222326',
    elevated: '#1c1d20',
    menu: '#232427',
    text: '#f7f8f8',
    textMuted: '#8a8f98',
    textFaint: '#5c6068',
    primary: '#7c85e8',
    onPrimary: '#ffffff',
    primarySoft: 'rgba(124, 133, 232, 0.16)',
    primaryContainer: '#2f3470',
    onPrimaryContainer: '#e0e2fa',
    danger: '#ff6369',
    success: '#4cc38a',
    separator: 'rgba(255, 255, 255, 0.07)',
    border: 'rgba(255, 255, 255, 0.1)',
    inputBackground: '#18191b',
    placeholder: '#5c6068',
    ripple: 'rgba(255, 255, 255, 0.1)',
    scrim: 'rgba(0, 0, 0, 0.6)',
  },
  type,
  spacing,
  radius: lightTheme.radius,
} as const

const appThemes = { light: lightTheme, dark: darkTheme }

const breakpoints = { xs: 0, sm: 380, md: 768, lg: 1024 }

type AppThemes = typeof appThemes
type AppBreakpoints = typeof breakpoints

/* eslint-disable @typescript-eslint/no-empty-object-type -- module augmentation */
declare module 'react-native-unistyles' {
  export interface UnistylesThemes extends AppThemes {}
  export interface UnistylesBreakpoints extends AppBreakpoints {}
}
/* eslint-enable @typescript-eslint/no-empty-object-type */

StyleSheet.configure({
  themes: appThemes,
  breakpoints,
  settings: { adaptiveThemes: true },
})
