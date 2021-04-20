import dotenv from 'dotenv';
import express from 'express';
import getRouter from './routes';
import Database from './tools/database';
import logger from './tools/logger';

if (process.env.NODE_ENV === 'dev') {
  dotenv.config({ path: '.env.dev' });
}

async function main() {
  logger.info('[System] 시스템을 활성화하고 있습니다.');
  const app = express();
  await Database.initPrisma();
  app.use('/v1/ride', getRouter());
  app.listen(process.env.WEB_PORT, () => {
    logger.info('[System] 시스템이 준비되었습니다.');
  });
}

main();
