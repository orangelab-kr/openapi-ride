import { OPCODE, Pricing, Ride, RideMiddleware, Wrapper } from '..';

import { Router } from 'express';

export function getRidesRouter(): Router {
  const router = Router();

  router.post(
    '/',
    Wrapper(async (req, res) => {
      const { rideId } = await Ride.startRide(
        req.loggined.accessKey.platform,
        req.body
      );

      res.json({ opcode: OPCODE.SUCCESS, rideId });
    })
  );

  router.delete(
    '/:rideId',
    RideMiddleware(),
    Wrapper(async (req, res) => {
      await Ride.terminateRide(req.ride, req.body);
      res.json({ opcode: OPCODE.SUCCESS });
    })
  );

  router.get(
    '/:rideId/pricing',
    RideMiddleware(),
    Wrapper(async (req, res) => {
      const pricing = await Pricing.getPricingByRide(req.ride, req.query);
      res.json({ opcode: OPCODE.SUCCESS, pricing });
    })
  );

  router.get(
    '/:rideId/timeline',
    RideMiddleware(),
    Wrapper(async (req, res) => {
      const timeline = await Ride.getTimeline(req.ride);
      res.json({ opcode: OPCODE.SUCCESS, timeline });
    })
  );

  return router;
}
