export const totalOf = (prices: readonly number[]): number => {
  let total = 0;
  for (const price of prices) {
    total += price;
  }
  return total;
};
