import { Router } from 'express';
import { RESULT, Wrapper } from '..';
import { Webhook } from '../controllers/webhook';

export function getWebhookRouter(): Router {
  const router = Router();

  router.post(
    '/lowBattery',
    Wrapper(async (req) => {
      await Webhook.onLowBattery(req.body);
      throw RESULT.SUCCESS();
    })
  );

  return router;
}
