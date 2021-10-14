import { RESULT, Ride, Wrapper } from '../..';

import { Router } from 'express';

export function getRidesLightsRouter(): Router {
  const router = Router();

  router.get(
    '/on',
    Wrapper(async (req) => {
      await Ride.setLights(req.ride, true);
      throw RESULT.SUCCESS();
    })
  );

  router.get(
    '/off',
    Wrapper(async (req) => {
      await Ride.setLights(req.ride, false);
      throw RESULT.SUCCESS();
    })
  );

  return router;
}
