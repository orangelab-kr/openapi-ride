import { Database, InternalClient, Joi } from '../tools';
import { InternalError, OPCODE, WebhookPermission } from 'openapi-internal-sdk';
import { PaymentModel, PaymentType, Prisma, RideModel } from '.prisma/client';

const { prisma } = Database;

const webhookClient = InternalClient.getWebhook([
  WebhookPermission.REQUESTS_SEND,
]);

export class Payment {
  public static async getPayments(props: {
    take?: number;
    skip?: number;
    search?: string;
    platformId?: string;
    franchiseId?: string;
    paymentType?: PaymentType;
    hasRefunded?: boolean;
    startedAt?: Date;
    endedAt?: Date;
    orderByField?: 'amount' | 'refundedAt' | 'createdAt' | 'updatedAt';
    orderBySort?: 'asc' | 'desc';
  }): Promise<{ payments: PaymentModel[]; total: number }> {
    const schema = Joi.object({
      take: Joi.number().default(10).optional(),
      skip: Joi.number().default(0).optional(),
      search: Joi.string().allow('').default('').optional(),
      platformId: Joi.string().uuid().optional(),
      franchiseId: Joi.string().uuid().optional(),
      hasRefunded: Joi.boolean().allow('').default(null).optional(),
      startedAt: Joi.date().default(new Date(0)).optional(),
      endedAt: Joi.date().default(new Date()).optional(),
      paymentType: Joi.string()
        .valid(...Object.keys(PaymentType))
        .optional(),
      orderByField: Joi.string()
        .valid('amount', 'refundedAt', 'createdAt', 'updatedAt')
        .default('desc')
        .optional(),
      orderBySort: Joi.string().valid('asc', 'desc').default('desc').optional(),
    });

    const {
      take,
      skip,
      search,
      platformId,
      franchiseId,
      paymentType,
      hasRefunded,
      startedAt,
      endedAt,
      orderByField,
      orderBySort,
    } = await schema.validateAsync(props);
    const orderBy = { [orderByField]: orderBySort };
    const where: Prisma.PaymentModelWhereInput = {
      createdAt: { gte: startedAt, lte: endedAt },
      OR: [
        { paymentId: search },
        { rideId: search },
        { platformId: search },
        { franchiseId: search },
        { description: { contains: search } },
      ],
    };

    if (platformId) where.platformId = platformId;
    if (franchiseId) where.franchiseId = franchiseId;
    if (paymentType) where.paymentType = paymentType;
    if (hasRefunded === true) where.refundedAt = { not: null };
    if (hasRefunded === false) where.refundedAt = null;
    const [total, payments] = await prisma.$transaction([
      prisma.paymentModel.count({ where }),
      prisma.paymentModel.findMany({
        take,
        skip,
        where,
        orderBy,
      }),
    ]);

    return { payments, total };
  }

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

  public static async getPaymentsByRide(
    ride: RideModel
  ): Promise<PaymentModel[]> {
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
    const { rideId, platformId, franchiseId } = ride;
    const payment = await prisma.paymentModel.create({
      data: {
        platformId,
        rideId,
        paymentType,
        amount,
        description,
        franchiseId,
      },
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
