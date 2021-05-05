import {
  InternalPermissionMiddleware,
  OPCODE,
  PERMISSION,
  Payment,
  Wrapper,
  getInternalRidesRouter,
} from '../..';

import { Router } from 'express';

export * from './rides';

export function getInternalRouter(): Router {
  const router = Router();

  router.use('/rides', getInternalRidesRouter());

  router.get(
    '/payments',
    InternalPermissionMiddleware(PERMISSION.PAYMENT_LIST),
    Wrapper(async (req, res) => {
      const { query } = req;
      const { payments, total } = await Payment.getPayments(query);
      res.json({ opcode: OPCODE.SUCCESS, payments, total });
    })
  );

  return router;
}
