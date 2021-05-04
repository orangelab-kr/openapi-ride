import {
  Callback,
  InternalClient,
  InternalError,
  OPCODE,
  Wrapper,
  logger,
} from '../tools';

import { PlatformPermission } from 'openapi-internal-sdk';

export function PlatformMiddleware(permissionIds: string[] = []): Callback {
  const platformClient = InternalClient.getPlatform([
    PlatformPermission.AUTHORIZE_USER,
    PlatformPermission.AUTHORIZE_ACCESS_KEY,
  ]);

  return Wrapper(async (req, res, next) => {
    try {
      const { headers } = req;
      const platformAccessKeyId = `${headers['x-hikick-platform-access-key-id']}`;
      const platformSecretAccessKey = `${headers['x-hikick-platform-secret-access-key']}`;
      const sessionId = `${headers['authorization']}`.substr(7);
      if (platformAccessKeyId && platformSecretAccessKey) {
        const accessKey = await platformClient.getAccessKeyWithPermissions({
          platformAccessKeyId,
          platformSecretAccessKey,
          permissionIds,
        });

        const { platform } = accessKey;
        req.loggined = { platform, accessKey };
      } else {
        const user = await platformClient.getUserWithPermissions({
          sessionId,
          permissionIds,
        });

        const { platform } = user;
        req.loggined = { platform, user };
      }

      next();
    } catch (err) {
      if (process.env.NODE_ENV === 'dev') {
        logger.error(err.message);
        logger.error(err.stack);
      }

      throw new InternalError(
        '인증이 필요한 서비스입니다.',
        OPCODE.REQUIRED_INTERNAL_LOGIN
      );
    }
  });
}
