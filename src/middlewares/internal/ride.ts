import { WrapperCallback, RESULT, Ride, Wrapper } from '../..';

export function InternalRideMiddleware(): WrapperCallback {
  return Wrapper(async (req, res, next) => {
    const { rideId } = req.params;
    if (typeof rideId !== 'string') throw RESULT.CANNOT_FIND_RIDE();
    req.internal.ride = await Ride.getRideOrThrow(rideId);
    next();
  });
}
