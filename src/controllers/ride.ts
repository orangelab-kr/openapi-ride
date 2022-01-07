import {
  MonitoringLogType,
  MonitoringStatus,
  PaymentType,
  Prisma,
  RideModel,
  RideTerminatedType,
} from '@prisma/client';
import dayjs from 'dayjs';
import {
  InsurancePermission,
  InternalDiscount,
  InternalKickboardMode,
  InternalPlatform,
  WebhookPermission,
} from 'openapi-internal-sdk';
import {
  BorrowedHelmet,
  Geometry,
  InternalClient,
  Joi,
  Monitoring,
  Payment,
  Pricing,
  prisma,
  RESULT,
} from '..';

export interface RideTimeline {
  latitude: number;
  longitude: number;
  battery: number;
  createdAt: Date;
}

export interface RideStatus {
  gps: {
    latitude: number;
    longitude: number;
    satelliteUsedCount: number;
    isValid: boolean;
    speed: number;
  };
  power: {
    speedLimit: number;
    scooter: {
      battery: number;
    };
  };
  isEnabled: boolean;
  isLightsOn: boolean;
  isFallDown: boolean;
  speed: number;
  createdAt: Date;
}

export class Ride {
  public static defaultInclude: Prisma.RideModelInclude = {
    startedPhoneLocation: true,
    startedKickboardLocation: true,
    terminatedPhoneLocation: true,
    terminatedKickboardLocation: true,
    receipt: {
      include: {
        standard: true,
        perMinute: true,
        surcharge: true,
      },
    },
  };

  public static async getRides(props: {
    take?: number;
    skip?: number;
    search?: string;
    platformId?: string | string[];
    franchiseId?: string | string[];
    regionId?: string | string[];
    discountGroupId?: string | string[];
    terminatedType?: RideTerminatedType | RideTerminatedType[];
    kickboardCode?: string | string[];
    monitoringStatus?: MonitoringStatus | MonitoringStatus[];
    startedAt?: Date;
    endedAt?: Date;
    showTerminated?: boolean;
    onlyTerminated?: boolean;
    onlyPhoto?: boolean;
    orderByField?:
      | 'price'
      | 'startedAt'
      | 'terminatedAt'
      | 'createdAt'
      | 'updatedAt';
    orderBySort?: 'asc' | 'desc';
  }): Promise<{ rides: RideModel[]; total: number }> {
    const schema = Joi.object({
      take: Joi.number().default(10).optional(),
      skip: Joi.number().default(0).optional(),
      search: Joi.string().allow('').optional(),
      platformId: Joi.array().items(Joi.string().uuid()).single().optional(),
      franchiseId: Joi.array().items(Joi.string().uuid()).single().optional(),
      regionId: Joi.array().items(Joi.string().uuid()).single().optional(),
      discountGroupId: Joi.array()
        .items(Joi.string().uuid())
        .single()
        .optional(),
      terminatedType: Joi.array()
        .items(Joi.string().valid(...Object.keys(RideTerminatedType)))
        .single()
        .optional(),
      kickboardCode: Joi.array().items(Joi.string()).single().optional(),
      monitoringStatus: Joi.array()
        .items(Joi.string().valid(...Object.keys(MonitoringStatus)))
        .single()
        .optional(),
      startedAt: Joi.date().default(new Date(0)).optional(),
      endedAt: Joi.date().default(new Date()).optional(),
      showTerminated: Joi.boolean().default(true).optional(),
      onlyTerminated: Joi.boolean().default(false).optional(),
      onlyPhoto: Joi.boolean().default(false).optional(),
      orderByField: Joi.string()
        .valid('price', 'startedAt', 'terminatedAt', 'createdAt', 'updatedAt')
        .default('startedAt')
        .optional(),
      orderBySort: Joi.string().valid('asc', 'desc').default('desc').optional(),
    });

    const {
      take,
      skip,
      search,
      platformId,
      franchiseId,
      regionId,
      discountGroupId,
      terminatedType,
      kickboardCode,
      monitoringStatus,
      startedAt,
      endedAt,
      showTerminated,
      onlyTerminated,
      onlyPhoto,
      orderByField,
      orderBySort,
    } = await schema.validateAsync(props);
    const orderBy = { [orderByField]: orderBySort };
    const where: Prisma.RideModelWhereInput = {
      startedAt: { gte: startedAt, lte: endedAt },
    };

    if (search) {
      where.OR = [
        { rideId: search },
        { kickboardCode: search },
        { insuranceId: search },
        { discountId: search },
        { franchiseId: search },
        { platformId: search },
        { userId: search },
        { realname: { contains: search } },
        { phone: { contains: search } },
        { receiptId: search },
      ];
    }

    const include = Ride.defaultInclude;
    if (platformId) where.platformId = { in: platformId };
    if (franchiseId) where.franchiseId = { in: franchiseId };
    if (regionId) where.regionId = { in: regionId };
    if (discountGroupId) where.discountGroupId = { in: discountGroupId };
    if (terminatedType) where.terminatedType = { in: terminatedType };
    if (kickboardCode) where.kickboardCode = { in: kickboardCode };
    if (monitoringStatus) where.monitoringStatus = { in: monitoringStatus };
    if (onlyTerminated) where.terminatedAt = { not: null };
    if (!showTerminated) where.terminatedAt = null;
    if (onlyPhoto) where.photo = { not: null };
    const [total, rides] = await prisma.$transaction([
      prisma.rideModel.count({ where }),
      prisma.rideModel.findMany({
        take,
        skip,
        where,
        orderBy,
        include,
      }),
    ]);

    return { rides, total };
  }

  public static async startRide(
    platform: InternalPlatform,
    props: {
      kickboardCode: string;
      userId: string;
      realname: string;
      phone: string;
      birthday: Date;
      discountId?: string;
      discountGroupId?: string;
      latitude: number;
      longitude: number;
      debug?: boolean;
    }
  ): Promise<RideModel> {
    const schema = Joi.object({
      kickboardCode: Joi.string().required(),
      userId: Joi.string().required(),
      realname: Joi.string().required(),
      phone: Joi.string()
        .regex(/^\+(\d*)$/)
        .messages({
          'string.pattern.base': '+ 로 시작하시는 전화번호를 입력해주세요.',
        })
        .required(),
      birthday: Joi.date().required(),
      discountGroupId: Joi.string().uuid().allow(null).optional(),
      discountId: Joi.string().uuid().allow(null).optional(),
      latitude: Joi.number().min(-90).max(90).required(),
      longitude: Joi.number().min(-180).max(180).required(),
      debug: Joi.boolean().optional(),
    }).with('discountGroupId', 'discountId');

    const {
      userId,
      realname,
      phone,
      birthday,
      discountGroupId,
      discountId,
      latitude,
      longitude,
      kickboardCode: code,
      debug,
    }: {
      kickboardCode: string;
      userId: string;
      realname: string;
      phone: string;
      birthday: Date;
      discountId?: string;
      discountGroupId?: string;
      latitude: number;
      longitude: number;
      debug?: boolean;
    } = await schema.validateAsync(props);
    const { platformId } = platform;
    const kickboardCode = code.toUpperCase();
    const kickboard = await InternalClient.getKickboard().getKickboard(
      kickboardCode
    );

    if (kickboard.mode !== InternalKickboardMode.READY) {
      throw RESULT.ALREADY_USING_KICKBOARD();
    }

    const { gps } = await kickboard.getLatestStatus();
    if (!debug && !gps.isValid) {
      const distance = Geometry.getDistance(
        { lat: gps.latitude, lng: gps.longitude },
        { lat: latitude, lng: longitude }
      );

      if (distance > 300) {
        throw RESULT.KICKBOARD_TOO_FAR({
          args: [Math.round(distance).toLocaleString()],
        });
      }
    }

    await kickboard.start();
    await kickboard.setPhoto(null);

    const { franchiseId, regionId } = kickboard;
    if (discountGroupId && discountId) {
      await InternalClient.getDiscount()
        .getDiscountGroup(discountGroupId)
        .then((discountGroup) => discountGroup.getDiscount(discountId))
        .then((discount) => discount.update({ lockedAt: new Date() }));
    }

    const insuranceClient = InternalClient.getInsurance([
      InsurancePermission.INSURANCE_START,
    ]);

    const { insuranceId } = await insuranceClient.start({
      provider: 'mertizfire',
      userId,
      platformId,
      kickboardCode,
      phone,
      latitude,
      longitude,
    });

    const startedPhoneLocation: Prisma.LocationModelCreateNestedOneWithoutStartedPhoneLocationInput =
      {
        create: { latitude, longitude },
      };

    const startedKickboardLocation: Prisma.LocationModelCreateNestedOneWithoutStartedKickboardLocationInput =
      {
        create: { latitude: gps.latitude, longitude: gps.longitude },
      };

    const ride = await prisma.rideModel.create({
      data: {
        kickboardCode,
        userId,
        realname,
        phone,
        birthday,
        discountGroupId,
        discountId,
        platformId,
        franchiseId,
        regionId,
        insuranceId,
        startedPhoneLocation,
        startedKickboardLocation,
      },
    });

    return ride;
  }

  public static async uploadRidePhoto(
    ride: RideModel,
    props: { photo: string }
  ): Promise<void> {
    const schema = Joi.object({
      photo: Joi.string().uri().optional(),
    });

    const { photo } = await schema.validateAsync(props);
    const { kickboardCode, terminatedAt } = ride;
    if (ride.photo) throw RESULT.ALREADY_PHOTO_UPLOAD();
    if (!terminatedAt) throw RESULT.PHOTO_UPLOAD_NOT_TERMINATE();
    if (dayjs(terminatedAt).add(30, 'minutes').isBefore(dayjs())) {
      throw RESULT.PHOTO_UPLOAD_TIMEOUT();
    }

    const { rideId } = ride;
    await prisma.rideModel.update({
      where: { rideId },
      data: { photo },
    });

    const isLastRide = await this.checkIsLastRide(ride);
    if (!isLastRide) return;
    await InternalClient.getKickboard()
      .getKickboard(kickboardCode)
      .then((kickboard) => kickboard.setPhoto(photo));
  }

  public static async changeDiscount(
    ride: RideModel,
    props: { discountGroupId?: string; discountId?: string }
  ): Promise<void> {
    if (ride.terminatedAt) throw RESULT.ALREADY_TERMINATED_RIDE();

    const { rideId } = ride;
    const data: Prisma.RideModelUpdateInput = {};
    const { discountGroupId, discountId } = await Joi.object({
      discountGroupId: Joi.string().uuid().allow(null).optional(),
      discountId: Joi.string().uuid().allow(null).optional(),
    })
      .with('discountGroupId', 'discountId')
      .validateAsync(props);

    const discountClient = InternalClient.getDiscount();
    let beforeDiscount: InternalDiscount | undefined;
    let afterDiscount: InternalDiscount | undefined;

    // 기존에 적용한 할인 쿠폰이 있을 경우, 적용을 해제함
    if (ride.discountGroupId && ride.discountId) {
      const { discountGroupId, discountId }: any = await ride;
      beforeDiscount = await discountClient
        .getDiscountGroup(discountGroupId)
        .then((discountGroup) => discountGroup.getDiscount(discountId));
      data.discountGroupId = null;
      data.discountId = null;
    }

    if (discountGroupId && discountId) {
      afterDiscount = await discountClient
        .getDiscountGroup(discountGroupId)
        .then((discountGroup) => discountGroup.getDiscount(discountId));
      data.discountGroupId = discountGroupId;
      data.discountId = discountId;
    }

    const transactions: Promise<any>[] = [
      prisma.rideModel.update({ where: { rideId }, data }),
    ];

    if (beforeDiscount) {
      transactions.push(beforeDiscount.update({ lockedAt: null }));
    }

    if (afterDiscount) {
      transactions.push(afterDiscount.update({ lockedAt: new Date() }));
    }

    await Promise.all(transactions);
  }

  public static async checkIsLastRide(ride: RideModel): Promise<boolean> {
    const { rideId, kickboardCode } = await ride;
    const lastRide = await prisma.rideModel.findFirst({
      where: { kickboardCode },
      orderBy: { createdAt: 'desc' },
    });

    if (!lastRide) return false;
    return rideId === lastRide.rideId;
  }

  public static async cancelInsurance(ride: RideModel): Promise<void> {
    const permissions = [
      InsurancePermission.INSURANCE_VIEW,
      InsurancePermission.INSURANCE_CANCEL,
    ];

    try {
      const { insuranceId } = ride;
      if (!insuranceId) return;
      await InternalClient.getInsurance(permissions)
        .getInsurance(insuranceId)
        .then((insurance) => insurance.cancel());
    } catch (err: any) {}
  }

  public static async terminateRide(
    ride: RideModel,
    props: {
      latitude?: number;
      longitude?: number;
      terminatedType?: RideTerminatedType;
      terminatedAt?: Date;
    }
  ): Promise<void> {
    if (ride.terminatedAt) throw RESULT.ALREADY_TERMINATED_RIDE();
    const schema = Joi.object({
      latitude: Joi.number().min(-90).max(90).optional(),
      longitude: Joi.number().min(-180).max(180).optional(),
      terminatedAt: Joi.date().default(new Date()).optional(),
      terminatedType: Joi.string()
        .valid(...Object.values(RideTerminatedType))
        .default(RideTerminatedType.USER_REQUESTED)
        .optional(),
    });

    const {
      latitude,
      longitude,
      terminatedType,
      terminatedAt,
    }: {
      latitude: number;
      longitude: number;
      terminatedType: RideTerminatedType;
      terminatedAt: Date;
    } = await schema.validateAsync(props);
    const { kickboardCode, discountGroupId, discountId, insuranceId } = ride;
    const kickboardClient = InternalClient.getKickboard();
    const kickboard = await kickboardClient.getKickboard(kickboardCode);

    const { gps } = await kickboard.getLatestStatus();
    await kickboard.lightOff();
    await kickboard.stop();

    if (discountGroupId && discountId) {
      await InternalClient.getDiscount()
        .getDiscountGroup(discountGroupId)
        .then((discountGroup) => discountGroup.getDiscount(discountId))
        .then((discount) => discount.update({ usedAt: new Date() }));
    }

    const terminatedPhoneLocation =
      latitude && longitude ? { create: { latitude, longitude } } : undefined;

    const terminatedKickboardLocation = {
      create: { latitude: gps.latitude, longitude: gps.longitude },
    };

    const insuranceClient = InternalClient.getInsurance([
      InsurancePermission.INSURANCE_END,
      InsurancePermission.INSURANCE_VIEW,
    ]);

    if (insuranceId) {
      try {
        await insuranceClient
          .getInsurance(insuranceId)
          .then((insurance) => insurance.end({ endedAt: terminatedAt }));
      } catch (err: any) {}
    }

    const { receipt, pricing } = await Pricing.getPricingByRide(ride, {
      latitude: gps.latitude,
      longitude: gps.longitude,
      terminatedAt,
    });

    const surchargePrice = receipt.surcharge.total;
    const servicePrice = receipt.total - surchargePrice;
    await Payment.addPayment(ride, {
      paymentType: PaymentType.SERVICE,
      amount: servicePrice,
    });

    await Payment.addPayment(ride, {
      description: '미운영 구역 반납',
      paymentType: PaymentType.SURCHARGE,
      amount: surchargePrice,
    });

    const helmet = await BorrowedHelmet.getCurrentBorrowedHelmet(ride);
    if (helmet && helmet.status === 'BORROWED' && pricing.helmetLostPrice) {
      await Payment.addPayment(ride, {
        description: '헬멧 분실',
        paymentType: PaymentType.SURCHARGE,
        amount: pricing.helmetLostPrice,
      });
    }

    await Monitoring.addMonitoringLog(
      ride,
      MonitoringLogType.INFO,
      '라이드가 종료되었습니다.'
    );

    const { rideId } = ride;
    const updatedRide = await prisma.rideModel.update({
      where: { rideId },
      include: Ride.defaultInclude,
      data: {
        terminatedAt,
        terminatedType,
        terminatedPhoneLocation,
        terminatedKickboardLocation,
        receipt: Pricing.getReceiptToCreateInput(receipt),
      },
    });

    await this.sendEndWebhook(updatedRide);
  }

  public static async getRideOrThrow(
    rideId: string,
    platform?: InternalPlatform
  ): Promise<RideModel> {
    const ride = await this.getRide(rideId, platform);
    if (!ride) throw RESULT.CANNOT_FIND_RIDE();
    return ride;
  }

  public static async sendEndWebhook(ride: RideModel): Promise<void> {
    const webhookClient = InternalClient.getWebhook([
      WebhookPermission.WEBHOOK_REQUEST_SEND,
    ]);

    await webhookClient.request(ride.platformId, {
      type: 'rideEnd',
      data: ride,
    });
  }

  public static async sendSpeedChangeWebhook(
    ride: RideModel,
    props: any
  ): Promise<void> {
    const webhookClient = InternalClient.getWebhook([
      WebhookPermission.WEBHOOK_REQUEST_SEND,
    ]);

    await webhookClient.request(ride.platformId, {
      type: 'speedChange',
      data: { ...props, ride },
    });
  }

  public static async getRide(
    rideId: string,
    platform?: InternalPlatform
  ): Promise<RideModel | null> {
    const platformId = platform && platform.platformId;
    const ride = await prisma.rideModel.findFirst({
      where: { platformId, rideId },
      include: Ride.defaultInclude,
    });

    return ride;
  }

  public static async getTimeline(ride: RideModel): Promise<RideTimeline[]> {
    const endedAt = ride.terminatedAt || new Date();
    const timeline = await InternalClient.getKickboard()
      .getKickboard(ride.kickboardCode)
      .then((kickboard) =>
        kickboard.getLatestStatusTimeline(ride.startedAt, endedAt)
      );

    return timeline.map(({ gps, power, createdAt }) => ({
      latitude: gps.latitude,
      longitude: gps.longitude,
      battery: power.scooter.battery,
      createdAt,
    }));
  }

  public static async setLights(
    ride: RideModel,
    enabled: boolean
  ): Promise<void> {
    if (ride.terminatedAt) throw RESULT.ALREADY_TERMINATED_RIDE();
    const kickboardClient = InternalClient.getKickboard();
    const kickboard = await kickboardClient.getKickboard(ride.kickboardCode);
    if (enabled) return kickboard.lightOn({ mode: 0, seconds: 0 });
    return kickboard.lightOff();
  }

  public static async setMaxSpeed(
    ride: RideModel,
    props: { maxSpeed?: number }
  ): Promise<void> {
    const { maxSpeed } = await Joi.object({
      maxSpeed: Joi.number()
        .min(0)
        .max(20)
        .allow(null)
        .default(null)
        .optional(),
    }).validateAsync(props);
    if (ride.terminatedAt) throw RESULT.ALREADY_TERMINATED_RIDE();
    await InternalClient.getKickboard()
      .getKickboard(ride.kickboardCode)
      .then((kickboard) => kickboard.setMaxSpeed(maxSpeed));
  }

  public static async getStatus(ride: RideModel): Promise<RideStatus> {
    if (ride.terminatedAt) throw RESULT.ALREADY_TERMINATED_RIDE();
    const kickboardClient = InternalClient.getKickboard();
    const { gps, power, isEnabled, isLightsOn, isFallDown, speed, createdAt } =
      await kickboardClient
        .getKickboard(ride.kickboardCode)
        .then((kickboard) => kickboard.getLatestStatus());

    return {
      gps: {
        latitude: gps.latitude,
        longitude: gps.longitude,
        satelliteUsedCount: gps.satelliteUsedCount,
        isValid: gps.isValid,
        speed: gps.speed,
      },
      power: {
        speedLimit: power.speedLimit,
        scooter: {
          battery: power.scooter.battery,
        },
      },
      isEnabled,
      isLightsOn,
      isFallDown,
      speed,
      createdAt,
    };
  }

  public static async setLock(
    ride: RideModel,
    enabled: boolean
  ): Promise<void> {
    if (ride.terminatedAt) throw RESULT.ALREADY_TERMINATED_RIDE();
    const kickboardClient = InternalClient.getKickboard();
    const kickboard = await kickboardClient.getKickboard(ride.kickboardCode);
    if (enabled) return kickboard.lock();
    return kickboard.unlock();
  }
}
