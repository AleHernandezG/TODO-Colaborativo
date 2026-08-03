import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'

export const uploadImageMaxWidth = 1280
export const uploadImageQuality = 0.7

export async function compressForUpload(input: { uri: string; width: number }): Promise<string> {
  const context = ImageManipulator.manipulate(input.uri)

  if (input.width > uploadImageMaxWidth) {
    context.resize({ width: uploadImageMaxWidth })
  }

  const rendered = await context.renderAsync()
  const saved = await rendered.saveAsync({
    format: SaveFormat.JPEG,
    compress: uploadImageQuality,
  })

  return saved.uri
}
