export class CheckoutError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'ITEM_NOT_FOUND'
      | 'INSUFFICIENT_STOCK'
      | 'AMOUNT_EXCEEDS_TOTAL',
    public readonly detail?: string,
  ) {
    super(message);
    this.name = 'CheckoutError';
  }
}
