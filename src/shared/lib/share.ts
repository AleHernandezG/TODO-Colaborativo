import * as Clipboard from 'expo-clipboard'
import { Share } from 'react-native'

export async function copyToClipboard(text: string): Promise<void> {
  await Clipboard.setStringAsync(text)
}

export async function shareText(message: string): Promise<void> {
  await Share.share({ message })
}
