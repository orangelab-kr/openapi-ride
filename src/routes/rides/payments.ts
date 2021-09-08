import {
  OPCODE,
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
    PlatformMiddleware({
      permissionIds: ['rides.payments.list'],
      final: true,
    }),
    Wrapper(async (req, res) => {
      const payments = await Payment.getPaymentsByRide(req.ride);
      res.json({ opcode: OPCODE.SUCCESS, payments });
    })
  );

  router.get(
    '/:paymentId',
    PlatformMiddleware({
      permissionIds: ['rides.payments.view'],
      final: true,
    }),
    PaymentMiddleware(),
    Wrapper(async (req, res) => {
      const { payment } = req;
      res.json({ opcode: OPCODE.SUCCESS, payment });
    })
  );

  router.get(
    '/:paymentId/process',
    PlatformMiddleware({
      permissionIds: ['rides.payments.process'],
      final: true,
    }),
    PaymentMiddleware(),
    Wrapper(async (req, res) => {
      const { payment } = req;
      await Payment.setProcessed(payment);
      res.json({ opcode: OPCODE.SUCCESS });
    })
  );

  router.post(
    '/',
    PlatformMiddleware({
      permissionIds: ['rides.payments.create'],
      final: true,
    }),
    Wrapper(async (req, res) => {
      const { ride, body } = req;
      const payment = await Payment.addPayment(ride, body);
      res.json({ opcode: OPCODE.SUCCESS, payment });
    })
  );

  router.delete(
    '/',
    PlatformMiddleware({
      permissionIds: ['rides.payments.refund'],
      final: true,
    }),
    Wrapper(async (req, res) => {
      await Payment.refundAllPayment(req.ride);
      res.json({ opcode: OPCODE.SUCCESS });
    })
  );

  router.delete(
    '/:paymentId',
    PlatformMiddleware({
      permissionIds: ['rides.payments.refund'],
      final: true,
    }),
    PaymentMiddleware(),
    Wrapper(async (req, res) => {
      await Payment.refundPayment(req.ride, req.payment);
      res.json({ opcode: OPCODE.SUCCESS });
    })
  );

  return router;
}
