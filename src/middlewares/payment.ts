import { Callback, InternalError, OPCODE, Wrapper } from '..';

import { Payment } from '../controllers';

export function InternalPaymentMiddleware(): Callback {
  return Wrapper(async (req, res, next) => {
    const { paymentId } = req.params;
    const { ride } = req.internal;
    if (!ride || typeof paymentId !== 'string') {
      throw new InternalError(
        '해당 결제 기록을 찾을 수 없습니다.',
        OPCODE.NOT_FOUND
      );
    }

    req.internal.payment = await Payment.getPaymentOrThrow(ride, paymentId);
    next();
  });
}
