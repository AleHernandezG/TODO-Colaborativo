import * as ImagePicker from 'expo-image-picker'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import { useSnackbar } from '../../../shared/hooks/use-snackbar'
import { compressForUpload } from '../../../shared/lib/image'

export type ImageSource = 'camera' | 'gallery'

const pickerOptions: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  allowsEditing: true,
  quality: 1,
}

export function usePickImage() {
  const showSnackbar = useSnackbar()
  const { t } = useTranslation()

  return useCallback(
    async (source: ImageSource): Promise<string | null> => {
      const permission =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync()

      if (!permission.granted) {
        showSnackbar(
          source === 'camera' ? t('items.image.cameraDenied') : t('items.image.galleryDenied'),
        )
        return null
      }

      try {
        const result =
          source === 'camera'
            ? await ImagePicker.launchCameraAsync(pickerOptions)
            : await ImagePicker.launchImageLibraryAsync(pickerOptions)

        if (result.canceled) {
          return null
        }

        const asset = result.assets[0]
        return await compressForUpload({ uri: asset.uri, width: asset.width })
      } catch {
        showSnackbar(t('items.image.pickFailed'))
        return null
      }
    },
    [showSnackbar, t],
  )
}
