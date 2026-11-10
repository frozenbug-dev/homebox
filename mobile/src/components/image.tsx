import { type ComponentType, useEffect, useEffectEvent } from 'react'
import { type StyleProp, View, type ViewStyle } from 'react-native'
import { NitroImage as NitroImageUntyped, useImage } from 'react-native-nitro-image'
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated'
import { StyleSheet } from 'react-native-unistyles'

/** A remote (`https://`) or local (`file://`) image. */
export interface ImageSource {
  uri: string
  /** Defaults to the URI. Set it when the URI carries something volatile, like a token. */
  cacheKey?: string
}

type Fit = 'cover' | 'contain'
type AsyncImageSource = Parameters<typeof useImage>[0]

// The package's own prop type doesn't resolve with this nitro-modules version.
const NitroImage = NitroImageUntyped as unknown as ComponentType<{
  image: AsyncImageSource
  resizeMode?: Fit
  recyclingKey?: string
  style?: StyleProp<ViewStyle>
}>

interface ImageProps {
  source: ImageSource
  /** Shown underneath until `source` has loaded (e.g. a thumbnail). */
  placeholder?: ImageSource
  contentFit?: Fit
  placeholderContentFit?: Fit
  /** Fade-in duration in ms once `source` has loaded. */
  transition?: number
  /** Lets a recycled list cell drop the previous row's image right away. */
  recyclingKey?: string
  /** The loaded image's pixel size. */
  onLoad?: (size: { width: number; height: number }) => void
  /** Called once the loaded image has been drawn. */
  onDisplay?: () => void
  style?: StyleProp<ViewStyle>
  accessibilityLabel?: string
}

const toAsync = (s: ImageSource): AsyncImageSource => ({
  url: s.uri,
  options: s.cacheKey ? { cacheKey: s.cacheKey } : undefined,
})

/**
 * Images, backed by Nitro Image (Coil on Android, SDWebImage on iOS).
 * A plain image goes through Nitro's deferred loader, which is what lists
 * want; placeholders, fades and load callbacks need the loaded image in JS,
 * so those use `useImage` instead.
 */
export function Image(props: ImageProps) {
  const { source, placeholder, transition, onLoad, onDisplay } = props
  if (placeholder || transition || onLoad || onDisplay) return <LoadedImage {...props} />
  const image = (
    <NitroImage
      image={toAsync(source)}
      resizeMode={props.contentFit ?? 'cover'}
      recyclingKey={props.recyclingKey}
      style={props.accessibilityLabel ? StyleSheet.absoluteFill : props.style}
    />
  )
  if (!props.accessibilityLabel) return image
  return (
    <View style={[styles.clip, props.style]} accessible accessibilityRole="image" accessibilityLabel={props.accessibilityLabel}>
      {image}
    </View>
  )
}

function LoadedImage({
  source,
  placeholder,
  contentFit = 'cover',
  placeholderContentFit,
  transition,
  onLoad,
  onDisplay,
  style,
  accessibilityLabel,
}: ImageProps) {
  const reducedMotion = useReducedMotion()
  const fade = !!transition && !reducedMotion
  const { image, error } = useImage(toAsync(source))
  const opacity = useSharedValue(fade ? 0 : 1)
  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }))

  const loaded = useEffectEvent((size: { width: number; height: number }) => {
    onLoad?.(size)
    if (fade) opacity.set(withTiming(1, { duration: transition }))
    // Nitro has no draw callback; the frame after the image arrives is when it's on screen.
    return requestAnimationFrame(() => onDisplay?.())
  })

  useEffect(() => {
    if (!image) return
    const frame = loaded({ width: image.width, height: image.height })
    return () => cancelAnimationFrame(frame)
  }, [image])

  useEffect(() => {
    if (error && __DEV__) console.warn('image failed to load', source.uri.split('?')[0], error.message)
  }, [error, source.uri])

  return (
    <View
      style={[styles.clip, style]}
      accessible={!!accessibilityLabel}
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}>
      {placeholder ? (
        <NitroImage
          image={toAsync(placeholder)}
          resizeMode={placeholderContentFit ?? contentFit}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      {image ? (
        <Animated.View style={[StyleSheet.absoluteFill, fadeStyle]}>
          <NitroImage image={image} resizeMode={contentFit} style={StyleSheet.absoluteFill} />
        </Animated.View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  clip: {
    overflow: 'hidden',
  },
})
