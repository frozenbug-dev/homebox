import { TextInput, View, type TextInputProps } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Icon, icons } from './icon'

/** In-content search box for sheets (screens use the native header search bar). */
export function SearchField(props: Omit<TextInputProps, 'style'>) {
  const { theme } = useUnistyles()
  return (
    <View style={styles.root}>
      <Icon name={icons.search} size={16} />
      <TextInput
        returnKeyType="search"
        enterKeyHint="search"
        clearButtonMode="while-editing"
        autoCapitalize="none"
        autoCorrect={false}
        placeholderTextColor={theme.colors.placeholder}
        cursorColor={theme.colors.primary}
        selectionColor={theme.colors.primary}
        style={styles.input}
        {...props}
      />
    </View>
  )
}

const styles = StyleSheet.create((theme) => ({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(2),
    height: 44,
    marginHorizontal: theme.spacing(4),
    marginBottom: theme.spacing(2),
    paddingHorizontal: theme.spacing(3),
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.inputBackground,
  },
  input: {
    flex: 1,
    height: 44,
    ...theme.type.body,
    color: theme.colors.text,
  },
}))
