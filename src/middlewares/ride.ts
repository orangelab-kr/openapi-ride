import { Callback, InternalError, OPCODE, Ride, Wrapper } from '..';

export default function RideMiddleware(): Callback {
  return Wrapper(async (req, res, next) => {
    const { rideId } = req.params;
    const { accessKey } = req.loggined;
    if (!accessKey || typeof rideId !== 'string') {
      throw new InternalError(
        '해당 라이드를 찾을 수 없습니다.',
        OPCODE.NOT_FOUND
      );
    }

    req.ride = await Ride.getRideOrThrow(accessKey.platform, rideId);
    next();
  });
}
