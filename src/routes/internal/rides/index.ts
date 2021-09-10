import { Router } from 'express';
import { PlatformPermission } from 'openapi-internal-sdk';
import {
  getInternalRidesLightsRouter,
  getInternalRidesLockRouter,
  getInternalRidesPaymentsRouter,
  InternalPermissionMiddleware,
  InternalRideMiddleware,
  OPCODE,
  PERMISSION,
  Pricing,
  Ride,
  Wrapper,
} from '../../..';
import { InternalClient } from '../../../tools';

export * from './lights';
export * from './lock';
export * from './payments';

const platformClient = InternalClient.getPlatform([
  PlatformPermission.PLATFORMS_VIEW,
]);

export function getInternalRidesRouter(): Router {
  const router = Router();

  router.use(
    '/:rideId/lock',
    InternalPermissionMiddleware(PERMISSION.RIDE_CONTROL),
    InternalRideMiddleware(),
    getInternalRidesLockRouter()
  );

  router.use(
    '/:rideId/lights',
    InternalPermissionMiddleware(PERMISSION.RIDE_CONTROL),
    InternalRideMiddleware(),
    getInternalRidesLightsRouter()
  );

  router.use(
    '/:rideId/payments',
    InternalRideMiddleware(),
    getInternalRidesPaymentsRouter()
  );

  router.get(
    '/',
    InternalPermissionMiddleware(PERMISSION.RIDE_LIST),
    Wrapper(async (req, res) => {
      const { query } = req;
      const { total, rides } = await Ride.getRides(query);
      res.json({ opcode: OPCODE.SUCCESS, rides, total });
    })
  );

  router.post(
    '/',
    Wrapper(async (req, res) => {
      const { body } = req;
      const platform = await platformClient.getPlatform(body.platformId);
      const { rideId } = await Ride.startRide(platform, body);
      res.json({ opcode: OPCODE.SUCCESS, rideId });
    })
  );

  router.delete(
    '/:rideId',
    InternalPermissionMiddleware(PERMISSION.RIDE_TERMINATE),
    InternalRideMiddleware(),
    Wrapper(async (req, res) => {
      const { query, internal } = req;
      await Ride.terminateRide(internal.ride, query);
      res.json({ opcode: OPCODE.SUCCESS });
    })
  );

  router.get(
    '/:rideId',
    InternalPermissionMiddleware(PERMISSION.RIDE_DETAILS),
    InternalRideMiddleware(),
    Wrapper(async (req, res) => {
      const { ride } = req.internal;
      res.json({ opcode: OPCODE.SUCCESS, ride });
    })
  );

  router.post(
    '/:rideId/photo',
    InternalRideMiddleware(),
    Wrapper(async (req, res) => {
      const { internal, body } = req;
      await Ride.uploadRidePhoto(internal.ride, body);
      res.json({ opcode: OPCODE.SUCCESS });
    })
  );

  router.get(
    '/:rideId/pricing',
    InternalPermissionMiddleware(PERMISSION.RIDE_PRICING),
    InternalRideMiddleware(),
    Wrapper(async (req, res) => {
      const { internal, query } = req;
      const pricing = await Pricing.getPricingByRide(
        internal.ride,
        query as any
      );

      res.json({ opcode: OPCODE.SUCCESS, pricing });
    })
  );

  router.get(
    '/:rideId/timeline',
    InternalPermissionMiddleware(PERMISSION.RIDE_TIMELINE),
    InternalRideMiddleware(),
    Wrapper(async (req, res) => {
      const timeline = await Ride.getTimeline(req.internal.ride);
      res.json({ opcode: OPCODE.SUCCESS, timeline });
    })
  );

  return router;
}
