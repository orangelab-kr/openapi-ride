import { InternalError, OPCODE, Wrapper, logger } from '../tools';
import express, { Router } from 'express';

import { PlatformMiddleware } from '../middlewares';
import { Pricing } from '../controllers/pricing';
import Ride from '../controllers/ride';
import morgan from 'morgan';
import os from 'os';

export default function getRouter(): Router {
  const router = Router();
  const hostname = os.hostname();
  const logging = morgan('common', {
    stream: { write: (str: string) => logger.info(`${str.trim()}`) },
  });

  router.use(logging);
  router.use(express.json());
  router.use(express.urlencoded({ extended: true }));

  router.post(
    '/start',
    PlatformMiddleware(),
    Wrapper(async (req, res) => {
      const { rideId } = await Ride.startRide(
        req.loggined.accessKey.platform,
        req.body
      );

      res.json({ opcode: OPCODE.SUCCESS, rideId });
    })
  );

  router.post(
    '/pricing',
    PlatformMiddleware(),
    Wrapper(async (req, res) => {
      const pricing = await Pricing.getPricing(req.body);
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
