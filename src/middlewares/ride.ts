import { WrapperCallback, RESULT, Ride, Wrapper } from '..';

export function RideMiddleware(props?: {
  throwIfTerminated: boolean;
}): WrapperCallback {
  const { throwIfTerminated } = {
    throwIfTerminated: false,
    ...props,
  };

  return Wrapper(async (req, res, next) => {
    const { rideId } = req.params;
    const { platform } = req.loggined;
    if (!platform || typeof rideId !== 'string') {
      throw RESULT.CANNOT_FIND_RIDE();
    }

    const ride = await Ride.getRideOrThrow(rideId, platform);
    if (throwIfTerminated && ride.terminatedAt) {
      throw RESULT.ALREADY_TERMINATED_RIDE();
    }

    req.ride = ride;
    next();
  });
}
