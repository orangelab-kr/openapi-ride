import { Database, InternalClient } from '../tools';
import { PaymentModel, PaymentType, RideModel } from '.prisma/client';

import { WebhookPermission } from 'openapi-internal-sdk';

const { prisma } = Database;

const webhookClient = InternalClient.getWebhook([
  WebhookPermission.REQUESTS_SEND,
]);

export class Payment {
  public static async refreshPrice(ride: RideModel): Promise<void> {
    const { rideId } = ride;
    const payments = await prisma.paymentModel.findMany({
      where: { rideId, hasRefund: false },
      orderBy: { createdAt: 'asc' },
      select: { amount: true },
    });

    let price = 0;
    payments.forEach(({ amount }) => (price += amount));
    await prisma.rideModel.update({ where: { rideId }, data: { price } });
  }

  public static async addPayment(
    ride: RideModel,
    paymentType: PaymentType,
    amount: number
  ): Promise<PaymentModel | undefined> {
    if (amount <= 0) return;
    const { rideId, platformId } = ride;
    const payment = await prisma.paymentModel.create({
      data: { platformId, rideId, paymentType, amount },
    });

    await Promise.all([
      Payment.sendPayment(payment),
      Payment.refreshPrice(ride),
    ]);

    return payment;
  }

  public static async sendPayment(payment: PaymentModel): Promise<void> {
    await webhookClient.request(payment.platformId, {
      type: 'payment',
      data: payment,
    });
  }

  public static async refundPayment(payment: PaymentModel): Promise<void> {
    await webhookClient.request(payment.platformId, {
      type: 'refund',
      data: payment,
    });
  }
}
