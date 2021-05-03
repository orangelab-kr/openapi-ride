import { Database, InternalClient, Joi } from '../tools';
import { InternalError, OPCODE, WebhookPermission } from 'openapi-internal-sdk';
import { PaymentModel, PaymentType, RideModel } from '.prisma/client';

const { prisma } = Database;

const webhookClient = InternalClient.getWebhook([
  WebhookPermission.REQUESTS_SEND,
]);

export class Payment {
  public static async refreshPrice(ride: RideModel): Promise<void> {
    const { rideId } = ride;
    const payments = await prisma.paymentModel.findMany({
      where: { rideId, refundedAt: null },
      orderBy: { createdAt: 'asc' },
      select: { amount: true },
    });

    let price = 0;
    payments.forEach(({ amount }) => (price += amount));
    await prisma.rideModel.update({ where: { rideId }, data: { price } });
  }

  public static async getPayments(ride: RideModel): Promise<PaymentModel[]> {
    const { rideId } = ride;
    const payments = await prisma.paymentModel.findMany({
      where: { rideId },
      orderBy: { createdAt: 'asc' },
    });

    return payments;
  }

  public static async addPayment(
    ride: RideModel,
    props: { paymentType: PaymentType; amount: number; description?: string }
  ): Promise<PaymentModel | undefined> {
    const schema = Joi.object({
      paymentType: Joi.string()
        .valid(...Object.keys(PaymentType))
        .required(),
      amount: Joi.number().required(),
      description: Joi.string().optional(),
    });

    const { paymentType, amount, description } = await schema.validateAsync(
      props
    );

    if (amount <= 0) return;
    const { rideId, platformId } = ride;
    const payment = await prisma.paymentModel.create({
      data: { platformId, rideId, paymentType, amount, description },
    });

    await Payment.sendPaymentWebhook(payment);
    await Payment.refreshPrice(ride);
    return payment;
  }

  public static async refundPayment(
    ride: RideModel,
    payment: PaymentModel
  ): Promise<void> {
    if (payment.refundedAt !== null) return;
    const { paymentId } = payment;
    payment = await prisma.paymentModel.update({
      where: { paymentId },
      data: { refundedAt: new Date() },
    });

    await Payment.sendRefundWebhook(payment);
    await Payment.refreshPrice(ride);
  }

  public static async sendPaymentWebhook(payment: PaymentModel): Promise<void> {
    await webhookClient.request(payment.platformId, {
      type: 'payment',
      data: payment,
    });
  }

  public static async sendRefundWebhook(payment: PaymentModel): Promise<void> {
    await webhookClient.request(payment.platformId, {
      type: 'refund',
      data: payment,
    });
  }

  public static async getPaymentOrThrow(
    ride: RideModel,
    paymentId: string
  ): Promise<PaymentModel> {
    const payment = await this.getPayment(ride, paymentId);
    if (!payment) {
      throw new InternalError(
        '해당 결제 내역을 찾을 수 없습니다.',
        OPCODE.NOT_FOUND
      );
    }

    return payment;
  }

  public static async getPayment(
    ride: RideModel,
    paymentId: string
  ): Promise<PaymentModel | null> {
    const { rideId } = ride;
    const payment = await prisma.paymentModel.findFirst({
      where: { rideId, paymentId },
    });

    return payment;
  }
}
