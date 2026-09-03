import { Text, View } from 'react-native'

type Props = {
  name: string
  highlighted?: boolean
  size?: 'md' | 'sm'
}

const box = {
  md: 'h-11 w-11',
  sm: 'h-9 w-9',
}

const letters = {
  md: 'text-base',
  sm: 'text-sm',
}

function initials(name: string): string {
  const clean = name.trim()
  if (!clean) {
    return '?'
  }
  const words = clean.split(/\s+/)
  if (words.length > 1) {
    return `${words[0][0]}${words[1][0]}`.toUpperCase()
  }
  return clean.slice(0, 2).toUpperCase()
}

export function MemberAvatar({ name, highlighted = false, size = 'md' }: Props) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className={`${box[size]} items-center justify-center rounded-full ${
        highlighted
          ? 'bg-primary dark:bg-primary-dark'
          : 'border border-line-strong bg-background dark:border-line-strong-dark dark:bg-background-dark'
      }`}
    >
      <Text
        className={`${letters[size]} font-bold ${
          highlighted
            ? 'text-on-primary dark:text-on-primary-dark'
            : 'text-content dark:text-content-dark'
        }`}
      >
        {initials(name)}
      </Text>
    </View>
  )
}
