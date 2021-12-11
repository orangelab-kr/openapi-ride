import { Router } from 'express';
import { InternalPaymentMiddleware, Payment, RESULT, Wrapper } from '../../..';

export function getInternalRidesPaymentsRouter(): Router {
  const router = Router();

  router.get(
    '/',
    Wrapper(async (req) => {
      const payments = await Payment.getPaymentsByRide(req.internal.ride);
      throw RESULT.SUCCESS({ details: { payments } });
    })
  );

  router.get(
    '/:paymentId',
    InternalPaymentMiddleware(),
    Wrapper(async (req) => {
      const { payment } = req.internal;
      throw RESULT.SUCCESS({ details: { payment } });
    })
  );

  router.get(
    '/:paymentId/process',
    InternalPaymentMiddleware(),
    Wrapper(async (req) => {
      const { internal } = req;
      await Payment.setProcessed(internal.payment);
      throw RESULT.SUCCESS();
    })
  );

  router.post(
    '/',
    Wrapper(async (req) => {
      const { internal, body } = req;
      const payment = await Payment.addPayment(internal.ride, body);
      throw RESULT.SUCCESS({ details: { payment } });
    })
  );

  router.delete(
    '/',
    Wrapper(async (req) => {
      await Payment.refundAllPayment(req.internal.ride, req.body);
      throw RESULT.SUCCESS();
    })
  );

  router.delete(
    '/:paymentId',
    InternalPaymentMiddleware(),
    Wrapper(async (req) => {
      const { internal, body } = req;
      await Payment.refundPayment(internal.ride, internal.payment, body);
      throw RESULT.SUCCESS();
    })
  );

  return router;
}
