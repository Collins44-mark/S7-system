export class CheckoutError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'ITEM_NOT_FOUND'
      | 'INSUFFICIENT_STOCK'
      | 'AMOUNT_EXCEEDS_TOTAL'
      | 'INSUFFICIENT_ACCOUNT'
      | 'PHONE_REQUIRED'
      | 'ORDER_CANCELLED'
      | 'DUPLICATE_ORDER_ITEM'
      | 'AMOUNT_BELOW_RECORDED_PAYMENTS',
    public readonly detail?: string,
  ) {
    super(message);
    this.name = 'CheckoutError';
  }
}
