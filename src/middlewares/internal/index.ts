import { Callback, InternalError, Joi, OPCODE, Wrapper, logger } from '../..';

import dayjs from 'dayjs';
import jwt from 'jsonwebtoken';

export * from './permissions';
export function InternalMiddleware(): Callback {
  return Wrapper(async (req, res, next) => {
    const { headers, query } = req;
    const token = headers.authorization
      ? headers.authorization.substr(7)
      : query.token;

    if (typeof token !== 'string') {
      throw new InternalError(
        '인증이 필요한 서비스입니다.',
        OPCODE.REQUIRED_INTERNAL_LOGIN
      );
    }

    const key = process.env.HIKICK_OPENAPI_DISCOUNT_KEY;
    if (!key || !token) {
      throw new InternalError(
        '인증이 필요한 서비스입니다.',
        OPCODE.REQUIRED_INTERNAL_LOGIN
      );
    }

    try {
      const data = jwt.verify(token, key);
      const schema = Joi.object({
        sub: Joi.string().valid('openapi-discount').required(),
        iss: Joi.string().required(),
        aud: Joi.string().email().required(),
        prs: Joi.string().required(),
        iat: Joi.date().timestamp().required(),
        exp: Joi.date().timestamp().required(),
      });

      const payload = await schema.validateAsync(data);
      const iat = dayjs(payload.iat);
      const exp = dayjs(payload.exp);
      const prs = parseInt(payload.prs, 36)
        .toString(2)
        .padStart(128, '0')
        .split('')
        .reverse()
        .map((v) => v === '1');

      req.internal = payload;
      req.internal.prs = prs;
      if (exp.diff(iat, 'hours') > 6) throw Error();
      logger.info(
        `[Internal] [${payload.iss}] ${payload.aud} - ${req.method} ${req.originalUrl}`
      );
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

    await next();
  });
}
