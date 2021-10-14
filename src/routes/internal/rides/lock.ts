import { RESULT, Ride, Wrapper } from '../../..';

import { Router } from 'express';

export function getInternalRidesLockRouter(): Router {
  const router = Router();

  router.get(
    '/on',
    Wrapper(async (req) => {
      await Ride.setLock(req.internal.ride, true);
      throw RESULT.SUCCESS();
    })
  );

  router.get(
    '/off',
    Wrapper(async (req) => {
      await Ride.setLock(req.internal.ride, false);
      throw RESULT.SUCCESS();
    })
  );

  return router;
}
