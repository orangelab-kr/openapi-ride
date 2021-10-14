import { RESULT, Wrapper, WrapperCallback } from '../..';

export enum PERMISSION {
  RIDE_LIST,
  RIDE_DETAILS,

  RIDE_START,
  RIDE_TERMINATE,

  RIDE_PHOTO,
  RIDE_PRICING,
  RIDE_TIMELINE,
  RIDE_CONTROL,

  PAYMENT_LIST,
  PAYMENT_DETAILS,
  PAYMENT_ADD,
  PAYMENT_REFUND,
}

export function InternalPermissionMiddleware(
  permission: PERMISSION
): WrapperCallback {
  return Wrapper(async (req, res, next) => {
    if (!req.internal.prs[permission]) {
      throw RESULT.PERMISSION_DENIED({ args: [PERMISSION[permission]] });
    }

    await next();
  });
}
