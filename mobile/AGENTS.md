Homecrate is the Expo / React Native mobile client for Homebox. Prioritize native look and feel, performance, and platform conventions over cross-platform sameness.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

The same applies to the third-party libraries below: most had major rewrites recently (Reanimated 4, Gesture Handler 3, VisionCamera 5, Unistyles 3, FlashList 2). Check the installed version's types in `node_modules` or its docs before using an API.

## Commands

This project uses **pnpm** — run Expo CLI as `pnpm expo <cmd>`.

```bash
pnpm expo install <package>  # ALWAYS use instead of pnpm add — resolves SDK-compatible versions
pnpm start                   # Metro in dev-client mode
pnpm ios | pnpm android      # build + run the dev client (needed after adding native code)
pnpm lint                    # eslint .
pnpm typecheck               # tsc --noEmit
pnpm doctor                  # expo-doctor
pnpm expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

Expo Go is **not** supported (Unistyles, VisionCamera, Nitro modules ship native code). Always use the development build.

## Design principles: native first

Homecrate should feel like a first-party app on each platform, not one design stretched over both.

- **Use native components wherever one exists.** Prefer platform primitives (native tabs, native stack headers, native sheets, SwiftUI / Jetpack Compose controls via `@expo/ui`, SF Symbols / Material Symbols) over JS re-implementations. Only build a custom JS component when no native equivalent exists or it can't be styled to fit.
- **Each platform follows its own design language.**
  - **iOS → Liquid Glass / Human Interface Guidelines.** Translucent glass materials for floating chrome (toolbars, floating buttons, overlays) via `expo-glass-effect` (`GlassView`, `GlassContainer`; guard with `isLiquidGlassAvailable()` and fall back to a blur/solid surface). Large titles, native search bars in headers, SF Symbols, context menus, `.sheet`-style presentations, system fonts and dynamic type.
  - **Android → Material 3 (Expressive).** Material components from `@expo/ui/jetpack-compose` (FAB, top app bar, chips, segmented buttons, snackbars, `ModalBottomSheet`, `PullToRefreshBox`, …), Material Symbols, Material dynamic color where possible, predictable back behaviour, edge-to-edge layout.
- **Diverge per platform when the conventions differ.** Use `Platform.select`, or platform files (`foo.ios.tsx` / `foo.android.tsx`) when the component trees differ substantially. Don't force iOS patterns onto Android (e.g. text "Back" buttons, bottom action sheets for every menu) or vice versa (FABs on iOS, ripples on iOS).
- **Respect system settings:** light/dark (Unistyles `adaptiveThemes`), dynamic type / font scale, reduced motion (`useReducedMotion` from Reanimated — shorten or skip animations), and safe areas (`rt.insets` in Unistyles).
- **Accessibility is not optional:** every pressable gets `accessibilityRole` and a label; hit targets ≥ 44pt (iOS) / 48dp (Android) — use `hitSlop` for small icons.

## Interaction guidelines

### Touch feedback
Every tappable element must give immediate, platform-appropriate feedback.

- **Android:** Material ripple. Use `Pressable` with `android_ripple={{ color: theme.colors.ripple, borderless: false, foreground: true }}` (borderless for icon buttons). Make sure the container clips (`overflow: 'hidden'`) so the ripple respects rounded corners.
- **iOS:** no ripple. Use a subtle highlight — opacity dim for list rows, a small scale-down (≈0.97) driven by Reanimated for cards/buttons — that animates in on press-in and springs back on release.
- Wrap this in a shared `PressableFeedback` component in `src/components/` rather than re-implementing it per screen.
- **Haptics (`expo-haptics`):** `selectionAsync()` for pickers/toggles/segment changes, `impactAsync(Light)` when a swipe action crosses its threshold or on long-press, `notificationAsync(Success | Warning | Error)` for completed/failed/destructive operations. Don't fire haptics on every ordinary tap.

### Motion & transitions (Reanimated 4)
- All custom animation goes through `react-native-reanimated` — never the RN `Animated` API, never JS-thread `setState` animation loops.
- Use **layout animations** (`entering` / `exiting` / `layout={LinearTransition}`) for items appearing, disappearing, and reordering in lists and forms.
- Prefer Reanimated 4 **CSS-style transitions/animations** (`transitionProperty`, `transitionDuration`, `animationName`) for simple state-driven style changes; use `useSharedValue` + `useAnimatedStyle` + `withSpring`/`withTiming` for gesture-driven or interruptible motion.
- Use **springs** for anything the user's finger drives or that should feel physical; timings for opacity/color fades. Keep UI transitions ~150–300 ms.
- Screen transitions come from the native stack — use the platform default and `Link.AppleZoom` / shared-element zoom on iOS where a thumbnail opens a detail screen. Don't hand-roll screen transitions in JS.
- Animate only `transform` and `opacity` where possible; avoid animating layout props on large trees.

### Sheets & modals
- **Navigational sheets** (a flow with its own screens, e.g. "Add item", "Edit location", filters) are **Expo Router routes** presented as native sheets: `presentation: 'formSheet'` with `sheetAllowedDetents` (e.g. `[0.5, 1]` or `'fitToContents'`), `sheetGrabberVisible: true`, and `sheetCornerRadius` left to the platform default. This gives native gestures, back handling, and deep links for free.
- **Transient in-place sheets** (quick actions, small pickers, confirmations with options) use the native sheet from `@expo/ui` (`BottomSheet` from `@expo/ui` universal / `ModalBottomSheet` on Android) — not a JS sheet library.
- Rules: one sheet at a time; always dismissible by swipe and by back (Android); start at the smallest detent that shows the primary action; keep the primary action reachable above the keyboard (see Keyboard); don't put long scrolling lists in a half-height sheet without expanding to full.
- Destructive confirmations: native `Alert` (iOS shows an alert / action sheet, Android a Material dialog), not a custom modal.

### Swipe actions & quick actions
Lists of items, locations, and labels should support fast actions without opening a detail screen.

- **Swipe actions** on list rows via `ReanimatedSwipeable` (`react-native-gesture-handler/ReanimatedSwipeable`):
  - Trailing (swipe left) for destructive / secondary actions (Delete, Archive, Move); leading (swipe right) for positive/quick actions (Quick edit quantity, Mark as checked, Favorite).
  - Full-swipe executes the primary action; give a haptic when it crosses the threshold; destructive full-swipes require confirmation or offer Undo (snackbar on Android, toast/banner on iOS).
  - Only one row open at a time; close the open row on scroll or when another row opens.
  - Every swipe action must also be reachable another way (context menu / long-press, detail screen) — swipes aren't discoverable and aren't accessible on their own. Add `accessibilityActions` for them.
- **Context menus / long-press:** use `Link.Menu` + `Link.MenuAction` (and `Link.Preview` on iOS) from `expo-router` for navigable rows, or `@expo/ui` `ContextMenu` (iOS) / `DropdownMenu` (Android) otherwise.
- **Header / toolbar actions** use `Stack.Toolbar` and `Stack.SearchBar` from `expo-router` instead of custom header buttons.
- Consider **home-screen quick actions** and **pull-to-refresh** (native `RefreshControl` / `PullToRefreshBox`) on every list backed by server data.

### Keyboard
`KeyboardProvider` (from `react-native-keyboard-controller`) is mounted in the root layout. Don't use RN's `KeyboardAvoidingView` or `Keyboard.dismiss()` hacks.

**Form layout**
- Wrap forms in `KeyboardAwareScrollView` so the focused field is always scrolled above the keyboard.
- Pin the submit button above the keyboard with `KeyboardStickyView`, and add `KeyboardToolbar` (prev / next / done arrows) to forms with more than a couple of fields.

**Field-to-field navigation ("tab" through the form)**
- The keyboard's return key must move to the next field, like Tab on desktop. Every field except the last gets `returnKeyType="next"` and `submitBehavior="submit"` (this keeps the keyboard open instead of blurring). Its `onSubmitEditing` focuses the next field with `KeyboardController.setFocusTo('next')`, or with a ref's `.focus()` when the order isn't the visual order.
- The **last** field gets `returnKeyType="done"` (or `"go"`/`"search"`/`"send"` to match the action), and its `onSubmitEditing` submits the form (TanStack Form `form.handleSubmit()`).
- Multiline fields keep return as a newline. Move past them with the toolbar's next arrow instead.
- Build this into a shared form-field component so every form gets it automatically, rather than wiring it by hand per screen.

**Correct keyboard and autofill per field type**. Always set `keyboardType`/`inputMode`, `textContentType` (iOS) and `autoComplete` (Android + iOS), plus capitalization and correction:

| Field | Props |
| --- | --- |
| Email | `keyboardType="email-address"`, `textContentType="emailAddress"`, `autoComplete="email"`, `autoCapitalize="none"`, `autoCorrect={false}` |
| Password (login) | `secureTextEntry`, `textContentType="password"`, `autoComplete="current-password"`, `autoCapitalize="none"` |
| Password (new) | `secureTextEntry`, `textContentType="newPassword"`, `autoComplete="new-password"`, plus `passwordRules` on iOS |
| Username | `textContentType="username"`, `autoComplete="username"`, `autoCapitalize="none"`, `autoCorrect={false}` |
| Integer (quantity) | `keyboardType="number-pad"` / `inputMode="numeric"` |
| Decimal (price, weight) | `keyboardType="decimal-pad"` / `inputMode="decimal"`. Parse with the locale's decimal separator. |
| Phone | `keyboardType="phone-pad"`, `textContentType="telephoneNumber"`, `autoComplete="tel"` |
| URL | `keyboardType="url"`, `textContentType="URL"`, `autoCapitalize="none"`, `autoCorrect={false}` |
| Search | `returnKeyType="search"`, `enterKeyHint="search"`, `clearButtonMode="while-editing"` (iOS) |
| Names / titles | `autoCapitalize="words"` (item and location names) or `"sentences"` (descriptions) |

`number-pad` / `decimal-pad` have no return key on iOS, so make sure `KeyboardToolbar` is present to move on from them.

**Interactive, animated keyboard dismissal**
- Any scrollable screen that can show the keyboard (forms, lists with a search field, notes) must let the user **swipe the keyboard down** while scrolling, with the keyboard tracking the finger:
  - Set `keyboardDismissMode="interactive"` on the `ScrollView` / `KeyboardAwareScrollView` / `FlashList` (iOS native interactive dismissal).
  - On Android, wrap the scrollable in `KeyboardGestureArea` with `interpolator="ios"` (and `offset` matching any sticky input/toolbar height) to get the same finger-tracking behaviour.
  - Set `keyboardShouldPersistTaps="handled"` so taps on buttons/rows inside the list work on the first tap while the keyboard is open.
- Content that sits on top of the keyboard (sticky composers, bottom action bars, FABs) should move frame-by-frame with it. Use `KeyboardStickyView`, or drive a Reanimated style from `useReanimatedKeyboardAnimation()` (`height`, `progress`), never a `Keyboard` event listener plus `setState`.

## Library guidance — what to use for what

| Need | Use | Don't use |
| --- | --- | --- |
| Routing, stacks, tabs, sheets, headers | `expo-router` (`NativeTabs`, `Stack`, `Stack.Toolbar`, `Stack.SearchBar`, `Link.Menu`/`Link.Preview`, `formSheet` routes) | `@react-navigation/*` directly, JS tab bars |
| Native UI controls | `@expo/ui` — universal components first, then `@expo/ui/swift-ui` (iOS) / `@expo/ui/jetpack-compose` (Android) for platform-specific ones | JS UI kits (Paper, Tamagui, gluestack, …) |
| iOS glass materials | `expo-glass-effect` | fake glass with blur + borders |
| Icons | `expo-symbols` / SF Symbols on iOS, Material Symbols on Android (`sf` / `md` props on native tab icons) | icon fonts, PNG icon sets |
| Styling & theming | `StyleSheet` from `react-native-unistyles` (theme in `src/theme/unistyles.ts`; tokens only, no hard-coded colors) | `StyleSheet` from `react-native`, inline color literals, NativeWind |
| Animation | `react-native-reanimated` 4 (+ `react-native-worklets`) | RN `Animated`, `LayoutAnimation` |
| Gestures, swipeable rows | `react-native-gesture-handler` 3 (`ReanimatedSwipeable`, gesture hooks) | PanResponder |
| Touch feedback | `Pressable` + `android_ripple` / Reanimated press-scale (shared component) | `TouchableOpacity`, `TouchableHighlight` |
| Haptics | `expo-haptics` | — |
| Keyboard handling | `react-native-keyboard-controller` (`KeyboardAwareScrollView`, `KeyboardStickyView`, `KeyboardToolbar`, `KeyboardGestureArea`, `KeyboardController.setFocusTo`, `useReanimatedKeyboardAnimation`) | `KeyboardAvoidingView`, `Keyboard` event listeners + `setState` |
| Lists | `@shopify/flash-list` v2 (`FlashList`) for anything that can grow | `FlatList`, `ScrollView` + `map` for long lists |
| Server state | `@tanstack/react-query` (`src/lib/query-client.ts`); one `queryOptions` factory per resource, mutations invalidate/optimistically update | fetching in `useEffect`, global stores for server data |
| Forms | `@tanstack/react-form` | ad-hoc `useState` per field |
| HTTP | global `fetch` — already backed by `react-native-nitro-fetch` (`src/lib/polyfills.ts`); import from `react-native-nitro-fetch` directly only for `prefetch` / `prefetchOnAppStart` | axios, other HTTP clients |
| Camera, scanning | `react-native-vision-camera` v5 (`Camera`, `useCameraPermission`, `usePhotoOutput`); barcode/QR via the v5 plugin packages | `expo-camera` |
| Images | `expo-image` | RN `Image` |

## Project conventions

- Entry point is `index.ts`: it installs the nitro-fetch globals (`src/lib/polyfills.ts`) and configures Unistyles (`src/theme/unistyles.ts`) before `expo-router/entry`. Keep that order.
- Routes live in `src/app/` (every file is a screen, `_layout.tsx` defines navigators). Non-route code goes in `src/components/`, `src/lib/`, `src/theme/`. The Unistyles Babel plugin only processes files under `src/`.
- Shared interaction primitives (pressable feedback, swipeable row, sheet wrappers) live in `src/components/` and are reused — don't re-implement them per screen.
- `ios/` and `android/` are generated (Continuous Native Generation). Never create or edit them by hand — configure native behaviour in `app.json` and config plugins. After adding a library with native code, rebuild with `pnpm ios` / `pnpm android`.
- Use EAS for cloud builds and OTA updates: `pnpm dlx eas-cli@latest <command>`. Docs: https://docs.expo.dev/eas/index.md
