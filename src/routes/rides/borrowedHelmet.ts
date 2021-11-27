import { Router } from 'express';
import { BorrowedHelmet, CurrentBorrowedHelmet, RESULT, Wrapper } from '../..';

export function getRidesBorrowedHelmetRouter(): Router {
  const router = Router();

  router.get(
    '/',
    CurrentBorrowedHelmet(),
    Wrapper(async (req) => {
      const { helmet } = req;
      throw RESULT.SUCCESS({ details: { helmet } });
    })
  );

  router.get(
    '/credentials',
    CurrentBorrowedHelmet(),
    Wrapper(async (req) => {
      const helmet = await BorrowedHelmet.getHelmetCredentials(req.ride);
      throw RESULT.SUCCESS({ details: { helmet } });
    })
  );

  router.get(
    '/borrow',
    Wrapper(async (req) => {
      const { ride, query } = req;
      const helmet = await BorrowedHelmet.borrowHelmet(ride, query);
      throw RESULT.SUCCESS({ details: { helmet } });
    })
  );

  router.patch(
    '/borrow',
    CurrentBorrowedHelmet(),
    Wrapper(async (req) => {
      const helmet = await BorrowedHelmet.borrowHelmetComplete(req.helmet);
      throw RESULT.SUCCESS({ details: { helmet } });
    })
  );

  router.get(
    '/return',
    CurrentBorrowedHelmet(),
    Wrapper(async (req) => {
      const helmet = await BorrowedHelmet.returnHelmet(req.helmet);
      throw RESULT.SUCCESS({ details: { helmet } });
    })
  );

  router.patch(
    '/return',
    CurrentBorrowedHelmet(),
    Wrapper(async (req) => {
      const helmet = await BorrowedHelmet.returnHelmetCompleted(req.helmet);
      throw RESULT.SUCCESS({ details: { helmet } });
    })
  );

  return router;
}
