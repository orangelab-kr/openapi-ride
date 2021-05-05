import { Callback, InternalError, OPCODE, Ride, Wrapper } from '../..';

export function InternalRideMiddleware(): Callback {
  return Wrapper(async (req, res, next) => {
    const { rideId } = req.params;
    if (typeof rideId !== 'string') {
      throw new InternalError(
        '해당 라이드를 찾을 수 없습니다.',
        OPCODE.NOT_FOUND
      );
    }

    req.internal.ride = await Ride.getRideOrThrow(rideId);
    next();
  });
}
