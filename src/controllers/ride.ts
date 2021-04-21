import { InsurancePermission, InternalPlatform } from 'openapi-internal-sdk';
import { InternalClient, Joi } from '../tools';

import Database from '../tools/database';
import { RideModel } from '@prisma/client';

const { prisma } = Database;

export default class Ride {
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
      kickboardCode,
      userId,
      realname,
      phone,
      birthday,
      discountGroupId,
      discountId,
      latitude,
      longitude,
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
    const kickboardClient = InternalClient.getKickboard();
    const insuranceClient = InternalClient.getInsurance([
      InsurancePermission.INSURANCE_START,
    ]);

    const kickboard = await kickboardClient.getKickboard(kickboardCode);
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
        startedPhoneLocation: {
          create: {
            latitude,
            longitude,
          },
        },
      },
    });

    return ride;
  }
}
