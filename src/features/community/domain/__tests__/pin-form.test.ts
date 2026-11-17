import { hasPinFormErrors, needsCurrentPin, validatePinForm } from '../pin-form'

const valid = { hasPin: true, currentPin: '1111', newPin: '2222', repeatPin: '2222' }

it('pide el PIN actual también a quien entró con un temporal', () => {
  expect(needsCurrentPin('set')).toBe(true)
  expect(needsCurrentPin('exposed')).toBe(true)
  expect(needsCurrentPin('none')).toBe(false)
})

it('no marca nada en un formulario correcto', () => {
  expect(hasPinFormErrors(validatePinForm(valid))).toBe(false)
})

it('pide el PIN actual solo si ya tienes uno', () => {
  expect(validatePinForm({ ...valid, currentPin: '' })).toEqual({ currentPin: 'invalid' })
  expect(validatePinForm({ ...valid, hasPin: false, currentPin: '' })).toEqual({})
})

it('marca un PIN nuevo que no tiene cuatro cifras', () => {
  expect(validatePinForm({ ...valid, newPin: '22a2', repeatPin: '22a2' })).toEqual({
    newPin: 'invalid',
  })
  expect(validatePinForm({ ...valid, newPin: '22222', repeatPin: '22222' })).toEqual({
    newPin: 'invalid',
  })
})

it('marca la repetición que no coincide, sin contar los espacios', () => {
  expect(validatePinForm({ ...valid, repeatPin: '2223' })).toEqual({ repeatPin: 'mismatch' })
  expect(validatePinForm({ ...valid, repeatPin: ' 2222 ' })).toEqual({})
})

it('no compara la repetición mientras el PIN nuevo esté mal', () => {
  expect(validatePinForm({ ...valid, newPin: '22', repeatPin: '9' })).toEqual({
    newPin: 'invalid',
  })
})

it('junta los errores de varios campos', () => {
  expect(validatePinForm({ hasPin: true, currentPin: '1', newPin: '', repeatPin: '' })).toEqual({
    currentPin: 'invalid',
    newPin: 'invalid',
  })
})
