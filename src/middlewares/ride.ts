import { WrapperCallback, RESULT, Ride, Wrapper } from '..';

export function RideMiddleware(): WrapperCallback {
  return Wrapper(async (req, res, next) => {
    const { rideId } = req.params;
    const { platform } = req.loggined;
    if (!platform || typeof rideId !== 'string') {
      throw RESULT.CANNOT_FIND_RIDE();
    }

    req.ride = await Ride.getRideOrThrow(rideId, platform);
    next();
  });
}
