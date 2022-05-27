import { Router } from 'express';
import {
  clusterInfo,
  getInternalRouter,
  getRidesRouter,
  getWebhookRouter,
  InternalMiddleware,
  Payment,
  PlatformMiddleware,
  RESULT,
  Wrapper,
} from '..';

export * from './internal';
export * from './rides';
export * from './webhook';

export function getRouter(): Router {
  const router = Router();

  router.use('/rides', getRidesRouter());
  router.use('/webhook', getWebhookRouter());
  router.use('/internal', InternalMiddleware(), getInternalRouter());
  router.get(
    '/',
    Wrapper(async () => {
      throw RESULT.SUCCESS({ details: clusterInfo });
    })
  );

  router.get(
    '/payments',
    PlatformMiddleware({
      permissionIds: ['rides.payments.all'],
      final: true,
    }),
    Wrapper(async (req) => {
      const { query } = req;
      query.platformId = req.loggined.platform.platformId;
      const { payments, total } = await Payment.getPayments(query);
      throw RESULT.SUCCESS({ details: { payments, total } });
    })
  );

  return router;
}
