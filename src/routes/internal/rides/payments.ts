import { InternalPaymentMiddleware, RESULT, Payment, Wrapper } from '../../..';

import { Router } from 'express';

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
      await Payment.refundAllPayment(req.internal.ride);
      throw RESULT.SUCCESS();
    })
  );

  router.delete(
    '/:paymentId',
    InternalPaymentMiddleware(),
    Wrapper(async (req) => {
      const { ride, payment } = req.internal;
      await Payment.refundPayment(ride, payment);
      throw RESULT.SUCCESS();
    })
  );

  return router;
}
