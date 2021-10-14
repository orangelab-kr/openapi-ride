import { WrapperCallback, Payment, RESULT, Wrapper } from '../..';

export function PaymentMiddleware(): WrapperCallback {
  return Wrapper(async (req, res, next) => {
    const { paymentId } = req.params;
    const { ride } = req;
    if (!ride || typeof paymentId !== 'string') {
      throw RESULT.CANNOT_FIND_PAYMENT();
    }

    req.payment = await Payment.getPaymentOrThrow(ride, paymentId);
    next();
  });
}
