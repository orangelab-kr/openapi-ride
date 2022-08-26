import { MonitoringStatus, RideModel } from '@prisma/client';
import * as Sentry from '@sentry/node';
import dayjs from 'dayjs';
import { logger, Monitoring, Ride } from '..';

export const processRide = async (ride: RideModel) => {
  const { rideId, realname, userId, phone } = ride;

  try {
    await Monitoring.setMonitoringStatus(ride, {
      monitoringStatus: MonitoringStatus.NO_PICTURE,
      sendMessage: false,
    });

    logger.info(
      `반납사진 체커 / ${rideId} - ${realname}(${userId}, ${phone})님의 반납사진 정보를 처리하였습니다.`
    );
  } catch (err: any) {
    const eventId = Sentry.captureException(err);
    logger.error(
      `반납사진 체커 / ${rideId} - ${realname}(${userId}, ${phone})님의 반납사진 여부를 확인할 수 없습니다. (${eventId})`
    );
  }
};

export const onReturnedPhotoChecker = async (): Promise<void> => {
  const take = 10;
  let total;
  let skip = 0;

  while (!total || total > skip) {
    const res = await Ride.getRides({
      take,
      skip,
      onlyNoPhoto: true,
      onlyTerminated: true,
      endedAt: dayjs().subtract(5, 'minutes').toDate(),
      monitoringStatus: MonitoringStatus.BEFORE_CONFIRM,
    });

    await Promise.all(res.rides.map((ride) => processRide(ride)));
    total = res.total;
    skip += take;
  }
};
