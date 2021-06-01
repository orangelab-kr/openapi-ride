import { Database, getRouter, logger } from '.';

import express from 'express';
import { InternalError } from './tools';

export * from './controllers';
export * from './middlewares';
export * from './tools';
export * from './routes';

async function main() {
  logger.info('[System] 시스템을 활성화하고 있습니다.');
  const app = express();
  InternalError.registerSentry(app);
  await Database.initPrisma();
  app.use('/v1/ride', getRouter());
  app.listen(process.env.WEB_PORT, () => {
    logger.info('[System] 시스템이 준비되었습니다.');
  });
}

main();
