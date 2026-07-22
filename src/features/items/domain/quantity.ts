export const minQuantity = 1

export function isValidQuantity(value: number): boolean {
  return Number.isInteger(value) && value >= minQuantity
}
