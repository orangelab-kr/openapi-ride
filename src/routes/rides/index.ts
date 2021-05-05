import {
  OPCODE,
  Pricing,
  Ride,
  RideMiddleware,
  Wrapper,
  getRidesLightsRouter,
  getRidesLockRouter,
  getRidesPaymentsRouter,
} from '../..';

import { Router } from 'express';

export * from './lights';
export * from './lock';
export * from './payments';

export function getRidesRouter(): Router {
  const router = Router();
  router.use('/:rideId/lights', RideMiddleware(), getRidesLightsRouter());
  router.use('/:rideId/lock', RideMiddleware(), getRidesLockRouter());
  router.use('/:rideId/payments', RideMiddleware(), getRidesPaymentsRouter());

  router.get(
    '/',
    Wrapper(async (req, res) => {
      const { query } = req;
      query.platformId = req.loggined.platform.platformId;
      const { total, rides } = await Ride.getRides(query);
      res.json({ opcode: OPCODE.SUCCESS, rides, total });
    })
  );

  router.post(
    '/',
    Wrapper(async (req, res) => {
      const { rideId } = await Ride.startRide(req.loggined.platform, req.body);
      res.json({ opcode: OPCODE.SUCCESS, rideId });
    })
  );

  router.post(
    '/:rideId/photo',
    RideMiddleware(),
    Wrapper(async (req, res) => {
      await Ride.uploadRidePhoto(req.ride, req.body);
      res.json({ opcode: OPCODE.SUCCESS });
    })
  );

  router.get(
    '/:rideId',
    RideMiddleware(),
    Wrapper(async (req, res) => {
      const { ride } = req;
      res.json({ opcode: OPCODE.SUCCESS, ride });
    })
  );

  router.delete(
    '/:rideId',
    RideMiddleware(),
    Wrapper(async (req, res) => {
      await Ride.terminateRide(req.ride, req.query);
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
