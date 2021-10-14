import { Router } from 'express';
import { RESULT, Ride, Wrapper } from '../..';

export function getRidesLockRouter(): Router {
  const router = Router();

  router.get(
    '/on',
    Wrapper(async (req) => {
      await Ride.setLock(req.ride, true);
      throw RESULT.SUCCESS();
    })
  );

  router.get(
    '/off',
    Wrapper(async (req) => {
      await Ride.setLock(req.ride, false);
      throw RESULT.SUCCESS();
    })
  );

  return router;
}
