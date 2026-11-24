export class CheckoutError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'ITEM_NOT_FOUND'
      | 'INSUFFICIENT_STOCK'
      | 'AMOUNT_EXCEEDS_TOTAL'
      | 'INSUFFICIENT_ACCOUNT'
      | 'PHONE_REQUIRED'
      | 'PHONE_IN_USE'
      | 'ORDER_CANCELLED'
      | 'DUPLICATE_ORDER_ITEM'
      | 'AMOUNT_BELOW_RECORDED_PAYMENTS'
      | 'DISCOUNT_INVALID'
      | 'DISCOUNT_EXCEEDS_TOTAL',
    public readonly detail?: string,
  ) {
    super(message);
    this.name = 'CheckoutError';
  }
}
