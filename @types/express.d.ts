import { PaymentModel, RideModel } from '.prisma/client';
import 'express';
import {
  InternalPlatform,
  InternalPlatformAccessKey,
  InternalPlatformUser,
} from 'openapi-internal-sdk';

declare global {
  namespace Express {
    interface Request {
      ride: RideModel;
      payment: PaymentModel;
      loggined: {
        platform: InternalPlatform;
        accessKey?: InternalPlatformAccessKey;
        user?: InternalPlatformUser;
      };
      internal: {
        sub: string;
        iss: string;
        aud: string;
        prs: boolean[];
        iat: Date;
        exp: Date;
      };
    }
  }
}
