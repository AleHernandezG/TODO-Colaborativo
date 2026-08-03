import * as Clipboard from 'expo-clipboard'
import { Share } from 'react-native'

import { copyToClipboard, shareText } from '../share'

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn().mockResolvedValue(true) }))

const setStringAsync = Clipboard.setStringAsync as jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
})

it('copia el texto tal cual al portapapeles', async () => {
  await copyToClipboard('PAN-42XK')

  expect(setStringAsync).toHaveBeenCalledWith('PAN-42XK')
})

it('abre el menú nativo con el mensaje', async () => {
  const share = jest
    .spyOn(Share, 'share')
    .mockResolvedValue({ action: 'sharedAction', activityType: null })

  await shareText('Entra con el código PAN-42XK')

  expect(share).toHaveBeenCalledWith({ message: 'Entra con el código PAN-42XK' })
})

it('propaga el fallo del menú nativo', async () => {
  jest.spyOn(Share, 'share').mockRejectedValue(new Error('no activity'))

  await expect(shareText('lo que sea')).rejects.toThrow('no activity')
})
