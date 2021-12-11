import {
  RESULT,
  Payment,
  PaymentMiddleware,
  PlatformMiddleware,
  Wrapper,
} from '../..';

import { Router } from 'express';

export function getRidesPaymentsRouter(): Router {
  const router = Router();

  router.get(
    '/',
    PlatformMiddleware({ permissionIds: ['rides.payments.list'], final: true }),
    Wrapper(async (req) => {
      const payments = await Payment.getPaymentsByRide(req.ride);
      throw RESULT.SUCCESS({ details: { payments } });
    })
  );

  router.get(
    '/:paymentId',
    PlatformMiddleware({ permissionIds: ['rides.payments.view'], final: true }),
    PaymentMiddleware(),
    Wrapper(async (req) => {
      const { payment } = req;
      throw RESULT.SUCCESS({ details: { payment } });
    })
  );

  router.get(
    '/:paymentId/process',
    PlatformMiddleware({
      permissionIds: ['rides.payments.process'],
      final: true,
    }),
    PaymentMiddleware(),
    Wrapper(async (req) => {
      const { payment } = req;
      await Payment.setProcessed(payment);
      throw RESULT.SUCCESS();
    })
  );

  router.post(
    '/',
    PlatformMiddleware({
      permissionIds: ['rides.payments.create'],
      final: true,
    }),
    Wrapper(async (req) => {
      const { ride, body } = req;
      const payment = await Payment.addPayment(ride, body);
      throw RESULT.SUCCESS({ details: { payment } });
    })
  );

  router.delete(
    '/',
    PlatformMiddleware({
      permissionIds: ['rides.payments.refund'],
      final: true,
    }),
    Wrapper(async (req) => {
      await Payment.refundAllPayment(req.ride, req.body);
      throw RESULT.SUCCESS();
    })
  );

  router.delete(
    '/:paymentId',
    PlatformMiddleware({
      permissionIds: ['rides.payments.refund'],
      final: true,
    }),
    PaymentMiddleware(),
    Wrapper(async (req) => {
      const { ride, body, payment } = req;
      await Payment.refundPayment(ride, payment, body);
      throw RESULT.SUCCESS();
    })
  );

  return router;
}
