import {
  MonitoringLogModel,
  MonitoringLogType,
  MonitoringStatus,
  PaymentType,
  RideModel,
} from '@prisma/client';
import { Joi, Payment, prisma } from '..';
import { sendMessageWithMessageGateway } from '../tools/messageGateway';

export class Monitoring {
  public static async getMonitoringLogs(
    ride: RideModel
  ): Promise<{ monitoringLogs: MonitoringLogModel[]; total: number }> {
    const { rideId } = ride;
    const where = { rideId };
    const orderBy: any = { createdAt: 'asc' };
    const [monitoringLogs, total] = await prisma.$transaction([
      prisma.monitoringLogModel.findMany({ where, orderBy }),
      prisma.monitoringLogModel.count({ where }),
    ]);

    return { monitoringLogs, total };
  }

  public static async addMonitoringLog(
    ride: RideModel,
    logType: MonitoringLogType,
    message: string
  ): Promise<MonitoringLogModel> {
    const { rideId, monitoringStatus } = ride;
    return prisma.monitoringLogModel.create({
      data: { rideId, monitoringStatus, logType, message },
    });
  }

  public static async setMonitoringStatus(
    ride: RideModel,
    props: {
      monitoringStatus: MonitoringStatus;
      sendMessage?: boolean;
      price?: number;
    }
  ): Promise<RideModel> {
    const { rideId, phone } = ride;
    const { monitoringStatus, sendMessage, price } = await Joi.object({
      monitoringStatus: Joi.string()
        .valid(...Object.keys(MonitoringStatus))
        .required(),
      sendMessage: Joi.boolean().optional(),
      price: Joi.number().optional(),
    }).validateAsync(props);

    const isFinalAction = [
      MonitoringStatus.TOWED_KICKBOARD,
      MonitoringStatus.COLLECTED_KICKBOARD,
    ].includes(monitoringStatus);
    const updatedRide = await prisma.rideModel.update({
      where: { rideId },
      data: { monitoringStatus },
    });

    await Monitoring.addMonitoringLog(
      updatedRide,
      MonitoringLogType.CHANGED,
      '상태가 변경되었습니다.'
    );

    if (isFinalAction) {
      await Monitoring.addMonitoringLog(
        updatedRide,
        MonitoringLogType.INFO,
        monitoringStatus === MonitoringStatus.TOWED_KICKBOARD
          ? '킥보드가 견인되었습니다.'
          : '킥보드가 수거되었습니다.'
      );
    }

    if (sendMessage) {
      type templates =
        | 'monitoring_danger_parking'
        | 'monitoring_in_collection_area'
        | 'monitoring_towed'
        | 'monitoring_wrong_picture';

      const templateBySituation: {
        [key in MonitoringStatus]: templates | null;
      } = {
        BEFORE_CONFIRM: null,
        CONFIRMED: null,
        WRONG_PARKING: 'monitoring_danger_parking',
        DANGER_PARKING: 'monitoring_danger_parking',
        IN_COLLECTION_AREA: 'monitoring_in_collection_area',
        WRONG_PICTURE: 'monitoring_wrong_picture',
        NO_PICTURE: 'monitoring_wrong_picture',
        COLLECTED_KICKBOARD: 'monitoring_towed',
        TOWED_KICKBOARD: 'monitoring_towed',
      };

      const name = templateBySituation[monitoringStatus as MonitoringStatus];
      if (name) {
        const fields = { ride };
        await sendMessageWithMessageGateway({ phone, name, fields });
        await Monitoring.addMonitoringLog(
          updatedRide,
          MonitoringLogType.SEND_MESSAGE,
          '메세지를 전송하였습니다.'
        );
      }
    }

    if (isFinalAction && price) {
      const description =
        monitoringStatus === MonitoringStatus.TOWED_KICKBOARD
          ? '견인됨'
          : '수거됨';
      await Payment.addPayment(ride, {
        description,
        paymentType: PaymentType.SURCHARGE,
        amount: price,
      });

      Monitoring.addMonitoringLog(
        updatedRide,
        MonitoringLogType.ADD_PAYMENT,
        `${price.toLocaleString()}원이 결제되었습니다.`
      );
    }

    return updatedRide;
  }
}
