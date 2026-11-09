import { StyleSheet } from 'react-native-unistyles'

const spacing = (v: number) => v * 4

const lightTheme = {
  colors: {
    background: '#ffffff',
    surface: '#f0f0f3',
    surfaceSelected: '#e0e1e6',
    text: '#000000',
    textMuted: '#60646c',
    primary: '#208aef',
    onPrimary: '#ffffff',
    danger: '#d93036',
    separator: 'rgba(60, 60, 67, 0.18)',
    inputBackground: '#f0f0f3',
    placeholder: '#8b8d98',
    ripple: 'rgba(0, 0, 0, 0.12)',
  },
  spacing,
  radius: { sm: 6, md: 10, lg: 16 },
} as const

const darkTheme = {
  colors: {
    background: '#000000',
    surface: '#212225',
    surfaceSelected: '#2e3135',
    text: '#ffffff',
    textMuted: '#b0b4ba',
    primary: '#4ca3f5',
    onPrimary: '#ffffff',
    danger: '#ff6369',
    separator: 'rgba(84, 84, 88, 0.6)',
    inputBackground: '#1c1c1f',
    placeholder: '#6f6f78',
    ripple: 'rgba(255, 255, 255, 0.16)',
  },
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
