import { changeMyPin } from '../change-my-pin'
import type { CommunityRepository, SetPinOutcome } from '../community-repository'

function repositoryAnswering(outcome: SetPinOutcome) {
  return {
    setMyPin: jest.fn().mockResolvedValue(outcome),
  } as unknown as jest.Mocked<CommunityRepository>
}

it('fija el PIN con el actual cuando ya lo tienes', async () => {
  const repository = repositoryAnswering({ status: 'ok' })

  const result = await changeMyPin(repository, {
    communityId: 'c1',
    hasPin: true,
    currentPin: ' 1111 ',
    newPin: '2222 ',
    repeatPin: '2222',
  })

  expect(result).toEqual({ status: 'ok' })
  expect(repository.setMyPin).toHaveBeenCalledWith({
    communityId: 'c1',
    newPin: '2222',
    currentPin: '1111',
  })
})

it('no manda el PIN actual cuando todavía no tienes', async () => {
  const repository = repositoryAnswering({ status: 'ok' })

  await changeMyPin(repository, {
    communityId: 'c1',
    hasPin: false,
    currentPin: '9999',
    newPin: '2222',
    repeatPin: '2222',
  })

  expect(repository.setMyPin).toHaveBeenCalledWith({
    communityId: 'c1',
    newPin: '2222',
    currentPin: undefined,
  })
})

it('no llama al servidor si el formulario está mal', async () => {
  const repository = repositoryAnswering({ status: 'ok' })

  const result = await changeMyPin(repository, {
    communityId: 'c1',
    hasPin: true,
    currentPin: '1111',
    newPin: '2222',
    repeatPin: '3333',
  })

  expect(result).toEqual({ status: 'invalid_form', errors: { repeatPin: 'mismatch' } })
  expect(repository.setMyPin).not.toHaveBeenCalled()
})

it('devuelve el rechazo del servidor sin traducirlo', async () => {
  const repository = repositoryAnswering({ status: 'wrong_pin' })

  const result = await changeMyPin(repository, {
    communityId: 'c1',
    hasPin: true,
    currentPin: '1111',
    newPin: '2222',
    repeatPin: '2222',
  })

  expect(result).toEqual({ status: 'wrong_pin' })
})
