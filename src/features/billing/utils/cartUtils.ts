import { CartItem } from "../types";

/**
 * Calculates the total number of units across all items in the cart.
 */
export function getCartTotalUnits(cart: CartItem[]): number {
  const total = cart.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  return Number.isInteger(total) ? total : Number(total.toFixed(3));
}
