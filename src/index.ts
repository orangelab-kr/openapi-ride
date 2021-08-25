import cors from 'cors';
import express from 'express';
import { OPCODE } from 'openapi-internal-sdk';
import {
  Database,
  getRouter,
  InternalError,
  logger,
  LoggerMiddleware,
  Wrapper,
} from '.';

export * from './controllers';
export * from './middlewares';
export * from './routes';
export * from './tools';

async function main() {
  logger.info('[System] 시스템을 활성화하고 있습니다.');
  const app = express();
  InternalError.registerSentry(app);
  await Database.initPrisma();

  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(LoggerMiddleware());
  app.use('/v1/ride', getRouter());
  app.all(
    '*',
    Wrapper(async () => {
      throw new InternalError('Invalid API', OPCODE.ERROR);
    })
  );

  app.listen(process.env.WEB_PORT, () => {
    logger.info('[System] 시스템이 준비되었습니다.');
  });
}

main();
