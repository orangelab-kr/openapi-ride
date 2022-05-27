import { PaymentModel, PaymentType, Prisma, RideModel } from '@prisma/client';
import { WebhookPermission } from '@hikick/openapi-internal-sdk';
import { InternalClient, Joi, prisma, RESULT, Ride } from '..';

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

  public static async setProcessed(payment: PaymentModel): Promise<void> {
    const { paymentId } = payment;
    await prisma.paymentModel.update({
      where: { paymentId },
      data: { processedAt: new Date() },
    });
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
    if (payments.length <= 0) await Ride.cancelInsurance(ride);
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
    const { paymentType, amount, description } = await Joi.object({
      paymentType: Joi.string()
        .valid(...Object.keys(PaymentType))
        .required(),
      amount: Joi.number().required(),
      description: Joi.string().optional(),
    }).validateAsync(props);
    if (amount <= 0) return;
    const initialAmount = amount;
    const { rideId, platformId, franchiseId } = ride;
    const payment = await prisma.paymentModel.create({
      include: {
        ride: {
          include: {
            startedPhoneLocation: true,
            startedKickboardLocation: true,
            terminatedPhoneLocation: true,
            terminatedKickboardLocation: true,
            receipt: true,
          },
        },
      },
      data: {
        platformId,
        rideId,
        paymentType,
        amount,
        initialAmount,
        description,
        franchiseId,
      },
    });

    await Payment.sendPaymentWebhook(payment);
    await Payment.refreshPrice(ride);
    return payment;
  }

  public static async refundAllPayment(
    ride: RideModel,
    props: { reason?: string }
  ): Promise<void> {
    const { rideId } = ride;
    props = await Joi.object({
      reason: Joi.string().optional(),
    }).validateAsync(props);
    const payments = await prisma.paymentModel.findMany({ where: { rideId } });
    await Promise.all(
      payments.map((payment) => this.refundPayment(ride, payment, props, false))
    );

    await Payment.refreshPrice(ride);
  }

  public static async refundPayment(
    ride: RideModel,
    payment: PaymentModel,
    props: { reason?: string; amount?: number },
    withRefreshPrice = true
  ): Promise<void> {
    const { paymentId, refundedAt } = payment;
    const { reason, amount } = await Joi.object({
      reason: Joi.string().optional(),
      amount: Joi.number()
        .max(payment.amount)
        .default(payment.amount)
        .optional(),
    }).validateAsync(props);
    if (refundedAt && !payment.amount) return;
    const updatedAmount = payment.amount - amount;
    payment = await prisma.paymentModel.update({
      where: { paymentId },
      include: {
        ride: {
          include: {
            startedPhoneLocation: true,
            startedKickboardLocation: true,
            terminatedPhoneLocation: true,
            terminatedKickboardLocation: true,
            receipt: true,
          },
        },
      },
      data: {
        reason,
        amount: updatedAmount,
        refundedAt: new Date(),
        processedAt: null,
      },
    });

    await Payment.sendRefundWebhook(payment, props);
    if (withRefreshPrice) await Payment.refreshPrice(ride);
  }

  public static async sendPaymentWebhook(payment: PaymentModel): Promise<void> {
    const webhookClient = InternalClient.getWebhook([
      WebhookPermission.WEBHOOK_REQUEST_SEND,
    ]);

    await webhookClient.request(payment.platformId, {
      type: 'payment',
      data: { payment },
    });
  }

  public static async sendRefundWebhook(
    payment: PaymentModel,
    props: { reason?: string; amount?: number }
  ): Promise<void> {
    const webhookClient = InternalClient.getWebhook([
      WebhookPermission.WEBHOOK_REQUEST_SEND,
    ]);

    const { reason, amount } = props;
    await webhookClient.request(payment.platformId, {
      type: 'refund',
      data: { payment, reason, amount },
    });
  }

  public static async getPaymentOrThrow(
    ride: RideModel,
    paymentId: string
  ): Promise<PaymentModel> {
    const payment = await this.getPayment(ride, paymentId);
    if (!payment) throw RESULT.CANNOT_FIND_PAYMENT();
    return payment;
  }

  public static async getPayment(
    ride: RideModel,
    paymentId: string
  ): Promise<PaymentModel | null> {
    const { rideId } = ride;
    const payment = await prisma.paymentModel.findFirst({
      where: { rideId, paymentId },
      include: {
        ride: {
          include: {
            startedPhoneLocation: true,
            startedKickboardLocation: true,
            terminatedPhoneLocation: true,
            terminatedKickboardLocation: true,
            receipt: true,
          },
        },
      },
    });

    return payment;
  }
}
