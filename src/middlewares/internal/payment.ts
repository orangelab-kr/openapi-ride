import { Callback, InternalError, OPCODE, Payment, Wrapper } from '../..';

export function PaymentMiddleware(): Callback {
  return Wrapper(async (req, res, next) => {
    const { paymentId } = req.params;
    const { ride } = req;
    if (!ride || typeof paymentId !== 'string') {
      throw new InternalError(
        '해당 결제 기록을 찾을 수 없습니다.',
        OPCODE.NOT_FOUND
      );
    }

    req.payment = await Payment.getPaymentOrThrow(ride, paymentId);
    next();
  });
}
