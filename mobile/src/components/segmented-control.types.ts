export interface SegmentedControlProps<T extends string> {
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  /** Used over a camera feed: light inactive text and borders. */
  onDark?: boolean
}
