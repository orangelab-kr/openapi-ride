import { OPCODE, Payment, PaymentMiddleware, Wrapper } from '../..';

import { Router } from 'express';

export function getRidesPaymentsRouter(): Router {
  const router = Router();

  router.get(
    '/',
    Wrapper(async (req, res) => {
      const payments = await Payment.getPaymentsByRide(req.ride);
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

  router.get(
    '/:paymentId/process',
    PaymentMiddleware(),
    Wrapper(async (req, res) => {
      const { payment } = req;
      await Payment.setProcessed(payment);
      res.json({ opcode: OPCODE.SUCCESS });
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
    '/',
    Wrapper(async (req, res) => {
      await Payment.refundAllPayment(req.ride);
      res.json({ opcode: OPCODE.SUCCESS });
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
