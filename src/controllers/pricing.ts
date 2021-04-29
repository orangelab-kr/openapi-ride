import {
  DiscountPermission,
  InternalDiscountGroup,
  InternalLocationPricing,
  InternalLocationProfile,
  LocationPermission,
} from 'openapi-internal-sdk';
import { InternalClient, Joi } from '../tools';
import { Prisma, ReceiptModel, RideModel } from '.prisma/client';

import dayjs from 'dayjs';

const locationClient = InternalClient.getLocation([
  LocationPermission.GEOFENCES_LOCATION,
]);

type ReceiptUnit = Prisma.ReceiptUnitModelCreateInput;
type Receipt = Prisma.ReceiptModelCreateInput & {
  standard: ReceiptUnit;
  perMinute: ReceiptUnit;
  surcharge: ReceiptUnit;
};

const discountClient = InternalClient.getDiscount([
  DiscountPermission.DISCOUNT_GROUP_VIEW,
  DiscountPermission.DISCOUNT_VIEW,
]);

export const DefaultPricingResult: Receipt = {
  standard: { price: 0, discount: 0, total: 0 },
  perMinute: { price: 0, discount: 0, total: 0 },
  surcharge: { price: 0, discount: 0, total: 0 },
  isNightly: false,
  price: 0,
  discount: 0,
  total: 0,
};

export class Pricing {
  public static async getPricingByRide(
    ride: RideModel,
    props: { latitude?: number; longitude?: number }
  ): Promise<Receipt> {
    const { latitude, longitude } = props;
    const { discountGroupId, discountId, startedAt } = ride;
    const minutes = dayjs(startedAt).diff(dayjs(), 'minutes');
    return this.getPricing({
      latitude,
      longitude,
      minutes,
      discountGroupId,
      discountId,
    });
  }

  public static getReceiptToCreateInput(
    receipt: Receipt
  ): Prisma.ReceiptModelUpdateOneWithoutRidesInput {
    const input: Prisma.ReceiptModelUpdateOneWithoutRidesInput = {};
    const {
      isNightly,
      price,
      discount,
      total,
      standard,
      perMinute,
      surcharge,
    } = receipt;
    input.create = {
      isNightly,
      price,
      discount,
      total,
      standard: { create: standard },
      perMinute: { create: perMinute },
      surcharge: { create: surcharge },
    };

    return input;
  }

  public static async getPricing(props: {
    discountGroupId: string | null;
    discountId: string | null;
    minutes: number;
    latitude?: number;
    longitude?: number;
  }): Promise<Receipt> {
    const receipt: Receipt = { ...DefaultPricingResult };
    receipt.isNightly = this.isNightly();

    const {
      latitude: lat,
      longitude: lng,
      minutes,
      discountGroupId,
      discountId,
    } = await Joi.object({
      latitude: Joi.number().min(-90).max(90).required(),
      longitude: Joi.number().min(-180).max(180).required(),
      minutes: Joi.number().required(),
      discountGroupId: Joi.string().allow(null).uuid().optional(),
      discountId: Joi.string().allow(null).uuid().optional(),
    }).validateAsync(props);
    const location = await locationClient.getGeofenceByLocation({ lat, lng });
    const [pricing, profile] = await Promise.all([
      location.getRegion().then((region) => region.getPricing()),
      location.getProfile(),
    ]);

    let discountGroup;
    if (discountGroupId && discountId) {
      discountGroup = await discountClient.getDiscountGroup(discountGroupId);
      await discountGroup.getDiscount(discountId);
    }

    receipt.standard = this.getStandardPrice({
      pricing,
      discountGroup,
      receipt,
    });

    receipt.perMinute = this.getPerMinutePrice({
      minutes,
      pricing,
      discountGroup,
      receipt,
    });

    receipt.surcharge = this.getSurchargePrice({
      pricing,
      discountGroup,
      receipt,
      profile,
    });

    receipt.price =
      receipt.standard.price +
      receipt.perMinute.price +
      receipt.surcharge.price;
    receipt.discount =
      receipt.standard.discount +
      receipt.perMinute.discount +
      receipt.surcharge.discount;
    receipt.total =
      receipt.standard.total +
      receipt.perMinute.total +
      receipt.surcharge.total;

    return receipt;
  }

  public static getPerMinutePrice(props: {
    minutes: number;
    pricing: InternalLocationPricing;
    discountGroup?: InternalDiscountGroup;
    receipt: Receipt;
  }): ReceiptUnit {
    const receiptUnit = { ...DefaultPricingResult.perMinute };
    const { minutes, pricing, discountGroup, receipt } = props;
    const perMinutePrice = receipt.isNightly
      ? pricing.perMinuteNightlyPrice
      : pricing.perMinuteStandardPrice;

    let discountMinute =
      (discountGroup && discountGroup.staticMinuteDiscount) || 0;
    let removedMinute = minutes - pricing.standardTime;
    if (removedMinute <= 0) removedMinute = 0;
    if (discountMinute > removedMinute) discountMinute = removedMinute;
    receiptUnit.price = removedMinute * perMinutePrice;
    receiptUnit.discount = discountMinute * perMinutePrice;
    if (discountGroup && discountGroup.isPerMinuteIncluded) {
      // 퍼센티지 할인
      if (discountGroup.ratioPriceDiscount) {
        receiptUnit.discount =
          receiptUnit.price * (discountGroup.ratioPriceDiscount / 100);
      }

      // 정적 할인
      if (discountGroup.staticPriceDiscount) {
        receiptUnit.discount += discountGroup.staticPriceDiscount;
        if (receiptUnit.discount > receiptUnit.price) {
          receiptUnit.discount = receiptUnit.price;
        }
      }
    }

    receiptUnit.total = receiptUnit.price - receiptUnit.discount;
    return receiptUnit;
  }

  public static getStandardPrice(props: {
    pricing: InternalLocationPricing;
    discountGroup?: InternalDiscountGroup;
    receipt: Receipt;
  }): ReceiptUnit {
    const receiptUnit = { ...DefaultPricingResult.standard };
    const { pricing, discountGroup, receipt } = props;
    const standardPrice = receipt.isNightly
      ? pricing.nightlyPrice
      : pricing.standardPrice;

    receiptUnit.price = standardPrice;
    if (discountGroup && discountGroup.isStandardIncluded) {
      // 퍼센티지 할인
      if (discountGroup.ratioPriceDiscount) {
        receiptUnit.discount =
          receiptUnit.price * (discountGroup.ratioPriceDiscount / 100);
      }

      // 정적 할인
      if (discountGroup.staticPriceDiscount) {
        receiptUnit.discount += discountGroup.staticPriceDiscount;
        if (receiptUnit.discount > receiptUnit.price) {
          receiptUnit.discount = receiptUnit.price;
        }
      }
    }

    receiptUnit.total = receiptUnit.price - receiptUnit.discount;
    return receiptUnit;
  }

  public static getSurchargePrice(props: {
    pricing: InternalLocationPricing;
    discountGroup?: InternalDiscountGroup;
    receipt: Receipt;
    profile: InternalLocationProfile;
  }): ReceiptUnit {
    const receiptUnit = { ...DefaultPricingResult.surcharge };
    const { pricing, discountGroup, receipt, profile } = props;
    if (!profile.hasSurcharge) return receiptUnit;

    receiptUnit.price = pricing.surchargePrice;
    if (discountGroup && discountGroup.isSurchargeIncluded) {
      // 퍼센티지 할인
      if (discountGroup.ratioPriceDiscount) {
        receiptUnit.discount =
          receiptUnit.price * (discountGroup.ratioPriceDiscount / 100);
      }

      // 정적 할인
      if (discountGroup.staticPriceDiscount && receipt.standard.total === 0) {
        const discountPrice =
          discountGroup.staticPriceDiscount - receipt.standard.discount;

        receiptUnit.discount += discountPrice;
        if (receiptUnit.discount > receiptUnit.price) {
          receiptUnit.discount = receiptUnit.price;
        }
      }
    }

    receiptUnit.total = receiptUnit.price - receiptUnit.discount;
    return receiptUnit;
  }

  public static isNightly(): boolean {
    // const hour = dayjs().hour();
    // return hour > 0 && hour < 6;
    return false;
  }
}
