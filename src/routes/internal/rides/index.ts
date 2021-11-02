import { Router } from 'express';
import { PlatformPermission } from 'openapi-internal-sdk';
import {
  getInternalRidesLightsRouter,
  getInternalRidesLockRouter,
  getInternalRidesPaymentsRouter,
  InternalClient,
  InternalPermissionMiddleware,
  InternalRideMiddleware,
  PERMISSION,
  Pricing,
  RESULT,
  Ride,
  Wrapper,
} from '../../..';

export * from './lights';
export * from './lock';
export * from './payments';

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
    Wrapper(async (req) => {
      const { query } = req;
      const { total, rides } = await Ride.getRides(query);
      throw RESULT.SUCCESS({ details: { rides, total } });
    })
  );

  router.post(
    '/',
    Wrapper(async (req) => {
      const { body } = req;
      const platformClient = InternalClient.getPlatform([
        PlatformPermission.PLATFORM_VIEW,
      ]);

      const platform = await platformClient.getPlatform(body.platformId);
      const { rideId } = await Ride.startRide(platform, body);
      throw RESULT.SUCCESS({ details: { rideId } });
    })
  );

  router.delete(
    '/:rideId',
    InternalPermissionMiddleware(PERMISSION.RIDE_TERMINATE),
    InternalRideMiddleware(),
    Wrapper(async (req) => {
      const { query, internal } = req;
      await Ride.terminateRide(internal.ride, query);
      throw RESULT.SUCCESS();
    })
  );

  router.get(
    '/:rideId',
    InternalPermissionMiddleware(PERMISSION.RIDE_DETAILS),
    InternalRideMiddleware(),
    Wrapper(async (req) => {
      const { ride } = req.internal;
      throw RESULT.SUCCESS({ details: { ride } });
    })
  );

  router.post(
    '/:rideId/photo',
    InternalRideMiddleware(),
    Wrapper(async (req) => {
      const { internal, body } = req;
      await Ride.uploadRidePhoto(internal.ride, body);
      throw RESULT.SUCCESS();
    })
  );

  router.get(
    '/:rideId/pricing',
    InternalPermissionMiddleware(PERMISSION.RIDE_PRICING),
    InternalRideMiddleware(),
    Wrapper(async (req) => {
      const { internal, query } = req;
      const pricing = await Pricing.getPricingByRide(
        internal.ride,
        query as any
      );

      throw RESULT.SUCCESS({ details: { pricing } });
    })
  );

  router.get(
    '/:rideId/timeline',
    InternalPermissionMiddleware(PERMISSION.RIDE_TIMELINE),
    InternalRideMiddleware(),
    Wrapper(async (req) => {
      const timeline = await Ride.getTimeline(req.internal.ride);
      throw RESULT.SUCCESS({ details: { timeline } });
    })
  );

  return router;
}
