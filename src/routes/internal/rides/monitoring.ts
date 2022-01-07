import { Router } from 'express';
import { Monitoring, RESULT, Wrapper } from '../../..';

export function getInternalRidesMonitoringRouter(): Router {
  const router = Router();

  router.get(
    '/',
    Wrapper(async (req) => {
      const { monitoringLogs, total } = await Monitoring.getMonitoringLogs(
        req.internal.ride
      );

      throw RESULT.SUCCESS({ details: { monitoringLogs, total } });
    })
  );

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
