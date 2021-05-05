import { InternalPaymentMiddleware, OPCODE, Payment, Wrapper } from '../../..';

import { Router } from 'express';

export function getInternalRidesPaymentsRouter(): Router {
  const router = Router();

  router.get(
    '/',
    Wrapper(async (req, res) => {
      const payments = await Payment.getPaymentsByRide(req.internal.ride);
      res.json({ opcode: OPCODE.SUCCESS, payments });
    })
  );

  router.get(
    '/:paymentId',
    InternalPaymentMiddleware(),
    Wrapper(async (req, res) => {
      const { payment } = req.internal;
      res.json({ opcode: OPCODE.SUCCESS, payment });
    })
  );

  router.post(
    '/',
    Wrapper(async (req, res) => {
      const { internal, body } = req;
      const payment = await Payment.addPayment(internal.ride, body);
      res.json({ opcode: OPCODE.SUCCESS, payment });
    })
  );

  router.delete(
    '/:paymentId',
    InternalPaymentMiddleware(),
    Wrapper(async (req, res) => {
      const { ride, payment } = req.internal;
      await Payment.refundPayment(ride, payment);
      res.json({ opcode: OPCODE.SUCCESS });
    })
  );

  return router;
}
