import { Router } from 'express';
import { Monitoring, RESULT, Wrapper } from '../../..';

export function getInternalRidesMonitoringRouter(): Router {
  const router = Router();

  router.post(
    '/',
    Wrapper(async (req) => {
      const { internal, body } = req;
      const ride = await Monitoring.setMonitoringStatus(internal.ride, body);
      throw RESULT.SUCCESS({ details: { ride } });
    })
  );

  return router;
}
