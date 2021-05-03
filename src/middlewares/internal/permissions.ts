import { Callback, InternalError, Wrapper } from '../..';

import { OPCODE } from '../../tools';

export enum PERMISSION {}

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
