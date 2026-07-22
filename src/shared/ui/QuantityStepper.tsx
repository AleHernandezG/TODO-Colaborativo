import { Pressable, Text, View } from 'react-native'

import { minTouchTarget } from '../../theme'

type QuantityStepperProps = {
  value: number
  onChange: (value: number) => void
  min?: number
  decrementLabel: string
  incrementLabel: string
  valueLabel: string
}

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  decrementLabel,
  incrementLabel,
  valueLabel,
}: QuantityStepperProps) {
  const canDecrement = value > min

  return (
    <View className="flex-row items-center gap-2">
      <StepperButton
        glyph="−"
        accessibilityLabel={decrementLabel}
        disabled={!canDecrement}
        onPress={() => onChange(value - 1)}
      />
      <Text
        accessibilityLabel={valueLabel}
        className="min-w-8 text-center text-lg font-semibold text-content dark:text-content-dark"
      >
        {value}
      </Text>
      <StepperButton
        glyph="+"
        accessibilityLabel={incrementLabel}
        onPress={() => onChange(value + 1)}
      />
    </View>
  )
}

function StepperButton({
  glyph,
  accessibilityLabel,
  onPress,
  disabled = false,
}: {
  glyph: string
  accessibilityLabel: string
  onPress: () => void
  disabled?: boolean
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      style={{ minWidth: minTouchTarget, minHeight: minTouchTarget }}
      className={`items-center justify-center rounded-md border border-line dark:border-line-dark ${
        disabled ? 'opacity-40' : 'active:opacity-70'
      }`}
    >
      <Text className="text-2xl font-semibold text-content dark:text-content-dark">{glyph}</Text>
    </Pressable>
  )
}
