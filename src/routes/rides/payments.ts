import { OPCODE, Payment, PaymentMiddleware, Wrapper } from '../..';

import { Router } from 'express';

export function getRidesPaymentsRouter(): Router {
  const router = Router();

  router.get(
    '/',
    Wrapper(async (req, res) => {
      const payments = await Payment.getPayments(req.ride);
      res.json({ opcode: OPCODE.SUCCESS, payments });
    })
  );

  router.get(
    '/:paymentId',
    PaymentMiddleware(),
    Wrapper(async (req, res) => {
      const { payment } = req;
      res.json({ opcode: OPCODE.SUCCESS, payment });
    })
  );

  router.post(
    '/',
    Wrapper(async (req, res) => {
      const { ride, body } = req;
      const payment = await Payment.addPayment(ride, body);
      res.json({ opcode: OPCODE.SUCCESS, payment });
    })
  );

  router.delete(
    '/:paymentId',
    PaymentMiddleware(),
    Wrapper(async (req, res) => {
      await Payment.refundPayment(req.ride, req.payment);
      res.json({ opcode: OPCODE.SUCCESS });
    })
  );

  return router;
}
