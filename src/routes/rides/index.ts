import {
  OPCODE,
  Pricing,
  Ride,
  RideMiddleware,
  Wrapper,
  getRidesLightsRouter,
  getRidesLockRouter,
  getRidesPaymentsRouter,
  PlatformMiddleware,
} from '../..';

import { Router } from 'express';

export * from './lights';
export * from './lock';
export * from './payments';

export function getRidesRouter(): Router {
  const router = Router();
  router.use(
    '/:rideId/lights',
    PlatformMiddleware({
      permissionIds: ['rides.lights'],
      final: true,
    }),
    RideMiddleware(),
    getRidesLightsRouter()
  );

  router.use(
    '/:rideId/lock',
    PlatformMiddleware({
      permissionIds: ['rides.lock'],
      final: true,
    }),
    RideMiddleware(),
    getRidesLockRouter()
  );

  router.use(
    '/:rideId/payments',
    PlatformMiddleware({
      permissionIds: ['rides.view'],
      final: true,
    }),
    RideMiddleware(),
    getRidesPaymentsRouter()
  );

  router.get(
    '/',
    PlatformMiddleware({
      permissionIds: ['rides.list'],
      final: true,
    }),
    Wrapper(async (req, res) => {
      const { query } = req;
      query.platformId = req.loggined.platform.platformId;
      const { total, rides } = await Ride.getRides(query);
      res.json({ opcode: OPCODE.SUCCESS, rides, total });
    })
  );

  router.post(
    '/',
    PlatformMiddleware({
      permissionIds: ['rides.start'],
      final: true,
    }),
    Wrapper(async (req, res) => {
      const { rideId } = await Ride.startRide(req.loggined.platform, req.body);
      res.json({ opcode: OPCODE.SUCCESS, rideId });
    })
  );

  router.post(
    '/:rideId/photo',
    PlatformMiddleware({
      permissionIds: ['rides.photo'],
      final: true,
    }),
    RideMiddleware(),
    Wrapper(async (req, res) => {
      await Ride.uploadRidePhoto(req.ride, req.body);
      res.json({ opcode: OPCODE.SUCCESS });
    })
  );

  router.get(
    '/:rideId/status',
    PlatformMiddleware({
      permissionIds: ['rides.status'],
      final: true,
    }),
    RideMiddleware(),
    Wrapper(async (req, res) => {
      const status = await Ride.getStatus(req.ride);
      res.json({ opcode: OPCODE.SUCCESS, status });
    })
  );

  router.get(
    '/:rideId',
    PlatformMiddleware({
      permissionIds: ['rides.view'],
      final: true,
    }),
    RideMiddleware(),
    Wrapper(async (req, res) => {
      const { ride } = req;
      res.json({ opcode: OPCODE.SUCCESS, ride });
    })
  );

  router.delete(
    '/:rideId',
    PlatformMiddleware({
      permissionIds: ['rides.terminate'],
      final: true,
    }),
    RideMiddleware(),
    Wrapper(async (req, res) => {
      await Ride.terminateRide(req.ride, req.query);
      res.json({ opcode: OPCODE.SUCCESS });
    })
  );

  router.get(
    '/:rideId/pricing',
    PlatformMiddleware({
      permissionIds: ['rides.pricing'],
      final: true,
    }),
    RideMiddleware(),
    Wrapper(async (req, res) => {
      const { ride, query } = req;
      const pricing = await Pricing.getPricingByRide(ride, query as any);
      res.json({ opcode: OPCODE.SUCCESS, pricing });
    })
  );

  router.get(
    '/:rideId/timeline',
    PlatformMiddleware({
      permissionIds: ['rides.timeline'],
      final: true,
    }),
    RideMiddleware(),
    Wrapper(async (req, res) => {
      const timeline = await Ride.getTimeline(req.ride);
      res.json({ opcode: OPCODE.SUCCESS, timeline });
    })
  );

  return router;
}
