import { Router } from 'express';
import {
  clusterInfo,
  getInternalRouter,
  getRidesRouter,
  InternalMiddleware,
  OPCODE,
  Payment,
  PlatformMiddleware,
  Wrapper,
} from '..';

export * from './internal';
export * from './rides';

export function getRouter(): Router {
  const router = Router();

  router.use('/rides', PlatformMiddleware(), getRidesRouter());
  router.use('/internal', InternalMiddleware(), getInternalRouter());
  router.get(
    '/',
    Wrapper(async (_req, res) => {
      res.json({
        opcode: OPCODE.SUCCESS,
        ...clusterInfo,
      });
    })
  );

  router.get(
    '/payments',
    PlatformMiddleware(),
    Wrapper(async (req, res) => {
      const { query } = req;
      query.platformId = req.loggined.platform.platformId;
      const { payments, total } = await Payment.getPayments(query);
      res.json({ opcode: OPCODE.SUCCESS, payments, total });
    })
  );

  return router;
}
