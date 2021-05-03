import { Database, InternalClient, InternalError, Joi, OPCODE } from '../tools';
import {
  InsurancePermission,
  InternalKickboardMode,
  InternalPlatform,
  WebhookPermission,
} from 'openapi-internal-sdk';
import {
  PaymentType,
  Prisma,
  RideModel,
  RideTerminatedType,
} from '@prisma/client';

import { Payment } from './payment';
import { Pricing } from '..';

const { prisma } = Database;
const kickboardClient = InternalClient.getKickboard();
const webhookClient = InternalClient.getWebhook([
  WebhookPermission.REQUESTS_SEND,
]);

const insuranceClient = InternalClient.getInsurance([
  InsurancePermission.INSURANCE_START,
  InsurancePermission.INSURANCE_VIEW,
  InsurancePermission.INSURANCE_END,
]);

interface RideTimeline {
  latitude: number;
  longitude: number;
  battery: number;
  createdAt: Date;
}

export class Ride {
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
      discountGroupId: Joi.string().uuid().optional(),
      discountId: Joi.string().uuid().optional(),
      latitude: Joi.number().min(-90).max(90).required(),
      longitude: Joi.number().min(-180).max(180).required(),
    });

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
    } = await schema.validateAsync(props);
    const { platformId } = platform;
    const kickboardCode = code.toUpperCase();
    const kickboard = await kickboardClient.getKickboard(kickboardCode);
    if (kickboard.mode !== InternalKickboardMode.READY) {
      throw new InternalError('사용중인 킥보드입니다.', OPCODE.ERROR);
    }

    const { gps } = await kickboard.getLatestStatus();
    await kickboard.setMaxSpeed(25);
    await kickboard.start();

    const { franchiseId, regionId } = kickboard;
    if (discountGroupId && discountId) {
      const discountClient = InternalClient.getDiscount();
      await discountClient
        .getDiscountGroup(discountGroupId)
        .then((discountGroup) => discountGroup.getDiscount(discountId))
        .then((discount) => discount.update({ usedAt: new Date() }));
    }

    const { insuranceId } = await insuranceClient.start({
      provider: 'mertizfire',
      userId,
      platformId,
      kickboardCode,
      phone,
      latitude,
      longitude,
    });

    const startedPhoneLocation: Prisma.LocationModelCreateNestedOneWithoutStartedPhoneLocationInput = {
      create: { latitude, longitude },
    };

    const startedKickboardLocation: Prisma.LocationModelCreateNestedOneWithoutStartedKickboardLocationInput = {
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

  public static async terminateRide(
    ride: RideModel,
    props: { latitude: number; longitude: number; returnedURL: string }
  ): Promise<void> {
    if (ride.terminatedAt) {
      throw new InternalError('이미 종료된 라이드입니다.', OPCODE.ERROR);
    }

    const schema = Joi.object({
      latitude: Joi.number().min(-90).max(90).required(),
      longitude: Joi.number().min(-180).max(180).required(),
      returnedURL: Joi.string().uri().optional(),
    });

    const {
      latitude,
      longitude,
      returnedURL,
    }: {
      latitude: number;
      longitude: number;
      returnedURL: string;
    } = await schema.validateAsync(props);
    const { kickboardCode, discountGroupId, discountId, insuranceId } = ride;
    const kickboard = await kickboardClient.getKickboard(kickboardCode);
    const { gps } = await kickboard.getLatestStatus();
    await kickboard.lightOff();
    await kickboard.stop();

    if (discountGroupId && discountId) {
      const discountClient = InternalClient.getDiscount();
      await discountClient
        .getDiscountGroup(discountGroupId)
        .then((discountGroup) => discountGroup.getDiscount(discountId))
        .then((discount) => discount.update({ usedAt: new Date() }));
    }

    const terminatedPhoneLocation = {
      create: { latitude, longitude },
    };

    const terminatedKickboardLocation = {
      create: { latitude: gps.latitude, longitude: gps.longitude },
    };

    if (insuranceId) {
      await insuranceClient
        .getInsurance(insuranceId)
        .then((insurance) => insurance.end());
    }

    const pricing = await Pricing.getPricingByRide(ride, {
      latitude,
      longitude,
    });

    const servicePrice = pricing.standard.total + pricing.perMinute.total;
    const surchargePrice = pricing.surcharge.total;
    await Payment.addPayment(ride, {
      paymentType: PaymentType.SERVICE,
      amount: servicePrice,
    });

    await Payment.addPayment(ride, {
      paymentType: PaymentType.SURCHARGE,
      amount: surchargePrice,
    });

    const { rideId } = ride;
    const terminatedAt = new Date();
    const terminatedType = RideTerminatedType.USER_REQUESTED;
    const receipt = Pricing.getReceiptToCreateInput(pricing);
    const updatedRide = await prisma.rideModel.update({
      where: { rideId },
      include: {
        startedPhoneLocation: true,
        startedKickboardLocation: true,
        terminatedPhoneLocation: true,
        terminatedKickboardLocation: true,
        receipt: true,
      },
      data: {
        returnedURL,
        terminatedAt,
        terminatedType,
        terminatedPhoneLocation,
        terminatedKickboardLocation,
        receipt,
      },
    });

    await this.sendEndWebhook(updatedRide);
  }

  public static async getRideOrThrow(
    platform: InternalPlatform,
    rideId: string
  ): Promise<RideModel> {
    const ride = await this.getRide(platform, rideId);
    if (!ride) {
      throw new InternalError(
        '해당 라이드를 찾을 수 없습니다.',
        OPCODE.NOT_FOUND
      );
    }

    return ride;
  }

  public static async sendEndWebhook(ride: RideModel): Promise<void> {
    await webhookClient.request(ride.platformId, {
      type: 'rideEnd',
      data: ride,
    });
  }

  public static async getRide(
    platform: InternalPlatform,
    rideId: string
  ): Promise<RideModel | null> {
    const { platformId } = platform;
    const ride = await prisma.rideModel.findFirst({
      where: { platformId, rideId },
      include: {
        startedPhoneLocation: true,
        startedKickboardLocation: true,
        terminatedPhoneLocation: true,
        terminatedKickboardLocation: true,
        receipt: true,
      },
    });

    return ride;
  }

  public static async getTimeline(ride: RideModel): Promise<RideTimeline[]> {
    const endedAt = ride.terminatedAt || new Date();
    const timeline = await kickboardClient
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
    if (ride.terminatedAt) {
      throw new InternalError('이미 종료된 라이드입니다.', OPCODE.ERROR);
    }

    const kickboard = await kickboardClient.getKickboard(ride.kickboardCode);
    if (enabled) await kickboard.lightOn({ mode: 0, seconds: 0 });
    else kickboard.lightOff();
  }

  public static async setLock(
    ride: RideModel,
    enabled: boolean
  ): Promise<void> {
    if (ride.terminatedAt) {
      throw new InternalError('이미 종료된 라이드입니다.', OPCODE.ERROR);
    }

    const kickboard = await kickboardClient.getKickboard(ride.kickboardCode);
    if (enabled) await kickboard.lock();
    else kickboard.unlock();
  }
}
