import { Callback, InternalError, OPCODE, Wrapper } from '../..';

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

export function InternalPermissionMiddleware(permission: PERMISSION): Callback {
  return Wrapper(async (req, res, next) => {
    if (!req.internal.prs[permission]) {
      throw new InternalError(
        `${PERMISSION[permission]} 권한이 없습니다.`,
        OPCODE.ACCESS_DENIED
      );
    }

    await next();
  });
}
