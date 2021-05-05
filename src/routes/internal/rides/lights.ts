import { OPCODE, Ride, Wrapper } from '../../..';

import { Router } from 'express';

export function getInternalRidesLightsRouter(): Router {
  const router = Router();

  router.get(
    '/on',
    Wrapper(async (req, res) => {
      await Ride.setLights(req.internal.ride, true);
      res.json({ opcode: OPCODE.SUCCESS });
    })
  );

  router.get(
    '/off',
    Wrapper(async (req, res) => {
      await Ride.setLights(req.internal.ride, false);
      res.json({ opcode: OPCODE.SUCCESS });
    })
  );

  return router;
}
