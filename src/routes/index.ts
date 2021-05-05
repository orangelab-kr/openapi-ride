import {
  InternalError,
  InternalMiddleware,
  OPCODE,
  Payment,
  PlatformMiddleware,
  Wrapper,
  getInternalRouter,
  getRidesRouter,
  logger,
} from '..';
import express, { Router } from 'express';

import cors from 'cors';
import morgan from 'morgan';
import os from 'os';

export * from './internal';
export * from './rides';

export function getRouter(): Router {
  const router = Router();
  const hostname = os.hostname();
  const logging = morgan('common', {
    stream: { write: (str: string) => logger.info(`${str.trim()}`) },
  });

  router.use(cors());
  router.use(logging);
  router.use(express.json());
  router.use(express.urlencoded({ extended: true }));
  router.use('/rides', PlatformMiddleware(), getRidesRouter());
  router.use('/internal', InternalMiddleware(), getInternalRouter());
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

  router.get(
    '/payments',
    PlatformMiddleware(),
    Wrapper(async (req, res) => {
      const { query } = req;
      query.platformId = req.loggined.platform.platformId;
      const { payments, total } = await Payment.getPayments(query);
      res.json({ opcode: OPCODE.SUCCESS, payments, total });
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
