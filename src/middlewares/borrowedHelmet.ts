import { BorrowedHelmet, Wrapper, WrapperCallback } from '..';

export function CurrentBorrowedHelmet(): WrapperCallback {
  return Wrapper(async (req, res, next) => {
    req.helmet = await BorrowedHelmet.getCurrentBorrowedHelmetOrThrow(req.ride);
    next();
  });
}
