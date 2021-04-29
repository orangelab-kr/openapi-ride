import {
  InternalError,
  OPCODE,
  PlatformMiddleware,
  Pricing,
  Ride,
  RideMiddleware,
  Wrapper,
  logger,
} from '..';
import express, { Router } from 'express';

import morgan from 'morgan';
import os from 'os';

export function getRouter(): Router {
  const router = Router();
  const hostname = os.hostname();
  const logging = morgan('common', {
    stream: { write: (str: string) => logger.info(`${str.trim()}`) },
  });

  router.use(logging);
  router.use(express.json());
  router.use(express.urlencoded({ extended: true }));

  router.post(
    '/',
    PlatformMiddleware(),
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
    PlatformMiddleware(),
    RideMiddleware(),
    Wrapper(async (req, res) => {
      await Ride.terminateRide(req.ride, req.body);
      res.json({ opcode: OPCODE.SUCCESS });
    })
  );

  router.get(
    '/:rideId/pricing',
    PlatformMiddleware(),
    RideMiddleware(),
    Wrapper(async (req, res) => {
      const pricing = await Pricing.getPricingByRide(req.ride, req.query);
      res.json({ opcode: OPCODE.SUCCESS, pricing });
    })
  );

  router.get(
    '/',
    Wrapper(async (_req, res) => {
      res.json({
        opcode: OPCODE.SUCCESS,
        name: process.env.npm_package_name,
        mode: process.env.NODE_ENV,
        version: process.env.npm_package_version,
        cluster: hostname,
      });
    })
  );

  router.all(
    '*',
    Wrapper(async () => {
      throw new InternalError('Invalid API');
    })
  );

  return router;
}
