import { MonitoringStatus, PaymentType, RideModel } from '@prisma/client';
import { Payment } from '.';
import { Joi, prisma } from '..';

export class Monitoring {
  public static async setMonitoringStatus(
    ride: RideModel,
    props: {
      monitoringStatus: MonitoringStatus;
      sendMessage?: boolean;
      price?: number;
    }
  ): Promise<RideModel> {
    const { rideId } = ride;
    const { monitoringStatus, sendMessage, price } = await Joi.object({
      monitoringStatus: Joi.string()
        .valid(...Object.keys(MonitoringStatus))
        .required(),
      sendMessage: Joi.boolean().optional(),
      price: Joi.number().optional(),
    }).validateAsync(props);

    // TODO: Send Alimtalk
    if (sendMessage) {
    }

    if (price) {
      await Payment.addPayment(ride, {
        paymentType: PaymentType.SURCHARGE,
        amount: price,
      });
    }

    return prisma.rideModel.update({
      where: { rideId },
      data: { monitoringStatus },
    });
  }
}
