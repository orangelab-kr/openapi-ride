import { OPCODE, Ride, Wrapper } from '../..';

import { Router } from 'express';

export function getRidesLockRouter(): Router {
  const router = Router();

  router.get(
    '/on',
    Wrapper(async (req, res) => {
      await Ride.setLock(req.ride, true);
      res.json({ opcode: OPCODE.SUCCESS });
    })
  );

  router.get(
    '/off',
    Wrapper(async (req, res) => {
      await Ride.setLock(req.ride, false);
      res.json({ opcode: OPCODE.SUCCESS });
    })
  );

  return router;
}
