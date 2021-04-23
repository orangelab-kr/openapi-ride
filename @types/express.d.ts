import { RideModel } from '.prisma/client';
import 'express';
import { InternalPlatformAccessKey } from 'openapi-internal-sdk';

declare global {
  namespace Express {
    interface Request {
      ride: RideModel;
      loggined: {
        accessKey: InternalPlatformAccessKey;
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
