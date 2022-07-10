import { BorrowedHelmet, Wrapper, WrapperCallback } from '..';

export function CurrentBorrowedHelmet({
  throwIfNotBorrowed = true,
} = {}): WrapperCallback {
  return Wrapper(async (req, res, next) => {
    req.helmet = throwIfNotBorrowed
      ? await BorrowedHelmet.getCurrentBorrowedHelmetOrThrow(req.ride)
      : await BorrowedHelmet.getCurrentBorrowedHelmet(req.ride);
    next();
  });
}
