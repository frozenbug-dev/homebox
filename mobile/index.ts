// Order matters: polyfills and Unistyles must be set up before any route module is evaluated.
import './src/lib/polyfills'
import './src/theme/unistyles'
import 'expo-router/entry'
