import { Router } from 'express';
import {
  getRidesBorrowedHelmetRouter,
  getRidesLightsRouter,
  getRidesLockRouter,
  getRidesPaymentsRouter,
  PlatformMiddleware,
  Pricing,
  RESULT,
  Ride,
  RideMiddleware,
  Wrapper,
} from '../..';

export * from './borrowedHelmet';
export * from './lights';
export * from './lock';
export * from './payments';

export function getRidesRouter(): Router {
  const router = Router();

  router.use(
    '/:rideId/lights',
    PlatformMiddleware({ permissionIds: ['rides.lights'], final: true }),
    RideMiddleware(),
    getRidesLightsRouter()
  );

  router.use(
    '/:rideId/lock',
    PlatformMiddleware({ permissionIds: ['rides.lock'], final: true }),
    RideMiddleware(),
    getRidesLockRouter()
  );

  router.use(
    '/:rideId/payments',
    PlatformMiddleware({ permissionIds: ['rides.view'], final: true }),
    RideMiddleware(),
    getRidesPaymentsRouter()
  );

  router.use(
    '/:rideId/borrowedHelmet',
    PlatformMiddleware({ permissionIds: ['rides.helmet'], final: true }),
    RideMiddleware({ throwIfTerminated: true }),
    getRidesBorrowedHelmetRouter()
  );

  router.get(
    '/',
    PlatformMiddleware({ permissionIds: ['rides.list'], final: true }),
    Wrapper(async (req) => {
      const { query } = req;
      query.platformId = req.loggined.platform.platformId;
      const { total, rides } = await Ride.getRides(query);
      throw RESULT.SUCCESS({ details: { rides, total } });
    })
  );

  router.post(
    '/',
    PlatformMiddleware({ permissionIds: ['rides.start'], final: true }),
    Wrapper(async (req) => {
      const { rideId } = await Ride.startRide(req.loggined.platform, req.body);
      throw RESULT.SUCCESS({ details: { rideId } });
    })
  );

  router.post(
    '/:rideId/photo',
    PlatformMiddleware({ permissionIds: ['rides.photo'], final: true }),
    RideMiddleware(),
    Wrapper(async (req) => {
      await Ride.uploadRidePhoto(req.ride, req.body);
      throw RESULT.SUCCESS();
    })
  );

  router.post(
    '/:rideId/discount',
    PlatformMiddleware({ permissionIds: ['rides.discount'], final: true }),
    RideMiddleware(),
    Wrapper(async (req) => {
      await Ride.changeDiscount(req.ride, req.body);
      throw RESULT.SUCCESS();
    })
  );

  router.get(
    '/:rideId/status',
    PlatformMiddleware({ permissionIds: ['rides.status'], final: true }),
    RideMiddleware(),
    Wrapper(async (req) => {
      const status = await Ride.getStatus(req.ride);
      throw RESULT.SUCCESS({ details: { status } });
    })
  );

  router.get(
    '/:rideId',
    PlatformMiddleware({ permissionIds: ['rides.view'], final: true }),
    RideMiddleware(),
    Wrapper(async (req) => {
      const { ride } = req;
      throw RESULT.SUCCESS({ details: { ride } });
    })
  );

  router.delete(
    '/:rideId',
    PlatformMiddleware({ permissionIds: ['rides.terminate'], final: true }),
    RideMiddleware(),
    Wrapper(async (req) => {
      await Ride.terminateRide(req.ride, req.query);
      throw RESULT.SUCCESS();
    })
  );

  router.get(
    '/:rideId/pricing',
    PlatformMiddleware({ permissionIds: ['rides.pricing'], final: true }),
    RideMiddleware(),
    Wrapper(async (req) => {
      const { ride, query } = req;
      const { receipt, pricing } = await Pricing.getPricingByRide(ride, query);
      throw RESULT.SUCCESS({ details: { receipt, pricing } });
    })
  );

  router.get(
    '/:rideId/timeline',
    PlatformMiddleware({ permissionIds: ['rides.timeline'], final: true }),
    RideMiddleware(),
    Wrapper(async (req) => {
      const timeline = await Ride.getTimeline(req.ride);
      throw RESULT.SUCCESS({ details: { timeline } });
    })
  );

  router.get(
    '/:rideId/maxSpeed',
    PlatformMiddleware({ permissionIds: ['rides.maxSpeed'], final: true }),
    RideMiddleware(),
    Wrapper(async (req) => {
      await Ride.setMaxSpeed(req.ride, req.query);
      throw RESULT.SUCCESS();
    })
  );

  return router;
}
