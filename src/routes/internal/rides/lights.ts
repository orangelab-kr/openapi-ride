import { RESULT, Ride, Wrapper } from '../../..';

import { Router } from 'express';

export function getInternalRidesLightsRouter(): Router {
  const router = Router();

  router.get(
    '/on',
    Wrapper(async (req) => {
      await Ride.setLights(req.internal.ride, true);
      throw RESULT.SUCCESS();
    })
  );

  router.get(
    '/off',
    Wrapper(async (req) => {
      await Ride.setLights(req.internal.ride, false);
      throw RESULT.SUCCESS();
    })
  );

  return router;
}
