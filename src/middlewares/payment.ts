import { RESULT, Wrapper, WrapperCallback } from '..';
import { Payment } from '../controllers';

export function InternalPaymentMiddleware(): WrapperCallback {
  return Wrapper(async (req, res, next) => {
    const { paymentId } = req.params;
    const { ride } = req.internal;
    if (!ride || typeof paymentId !== 'string') {
      throw RESULT.CANNOT_FIND_PAYMENT();
    }

    req.internal.payment = await Payment.getPaymentOrThrow(ride, paymentId);
    next();
  });
}
