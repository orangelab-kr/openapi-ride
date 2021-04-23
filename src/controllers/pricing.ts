import {
  DiscountPermission,
  InternalDiscountGroup,
  InternalLocationPricing,
  InternalLocationProfile,
  LocationPermission,
} from 'openapi-internal-sdk';
import { InternalClient, Joi } from '../tools';

const locationClient = InternalClient.getLocation([
  LocationPermission.GEOFENCES_LOCATION,
]);

const discountClient = InternalClient.getDiscount([
  DiscountPermission.DISCOUNT_GROUP_VIEW,
  DiscountPermission.DISCOUNT_VIEW,
]);

export interface PricingUnitResult {
  price: number;
  discount: number;
  total: number;
}

export interface PricingResult {
  standard: PricingUnitResult;
  perMinute: PricingUnitResult;
  surcharge: PricingUnitResult;
  isNightly: boolean;
  price: number;
  discount: number;
  total: number;
}

export const DefaultPricingResult: PricingResult = {
  standard: { price: 0, discount: 0, total: 0 },
  perMinute: { price: 0, discount: 0, total: 0 },
  surcharge: { price: 0, discount: 0, total: 0 },
  isNightly: false,
  price: 0,
  discount: 0,
  total: 0,
};

export class Pricing {
  public static async getPricing(props: {
    discountGroupId: string | null;
    discountId: string | null;
    minutes: number;
    latitude: number;
    longitude: number;
  }): Promise<PricingResult> {
    const result: PricingResult = { ...DefaultPricingResult };
    result.isNightly = this.isNightly();

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
      discountGroupId: Joi.string().uuid().optional(),
      discountId: Joi.string().uuid().optional(),
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

    result.standard = this.getStandardPrice({
      pricing,
      discountGroup,
      result,
    });

    result.perMinute = this.getPerMinutePrice({
      minutes,
      pricing,
      discountGroup,
      result,
    });

    result.surcharge = this.getSurchargePrice({
      pricing,
      discountGroup,
      result,
      profile,
    });

    result.price =
      result.standard.price + result.perMinute.price + result.surcharge.price;
    result.discount =
      result.standard.discount +
      result.perMinute.discount +
      result.surcharge.discount;
    result.total =
      result.standard.total + result.perMinute.total + result.surcharge.total;

    return result;
  }

  public static getPerMinutePrice(props: {
    minutes: number;
    pricing: InternalLocationPricing;
    discountGroup?: InternalDiscountGroup;
    result: PricingResult;
  }): PricingUnitResult {
    const unitResult = { ...DefaultPricingResult.perMinute };
    const { minutes, pricing, discountGroup, result } = props;
    const perMinutePrice = result.isNightly
      ? pricing.perMinuteNightlyPrice
      : pricing.perMinuteStandardPrice;

    let discountMinute =
      (discountGroup && discountGroup.staticMinuteDiscount) || 0;
    let removedMinute = minutes - pricing.standardTime;
    if (removedMinute <= 0) removedMinute = 0;
    if (discountMinute > removedMinute) discountMinute = removedMinute;
    unitResult.price = removedMinute * perMinutePrice;
    unitResult.discount = discountMinute * perMinutePrice;
    if (discountGroup && discountGroup.isPerMinuteIncluded) {
      // 퍼센티지 할인
      if (discountGroup.ratioPriceDiscount) {
        unitResult.discount =
          unitResult.price * (discountGroup.ratioPriceDiscount / 100);
      }

      // 정적 할인
      if (discountGroup.staticPriceDiscount) {
        unitResult.discount += discountGroup.staticPriceDiscount;
        if (unitResult.discount > unitResult.price) {
          unitResult.discount = unitResult.price;
        }
      }
    }

    unitResult.total = unitResult.price - unitResult.discount;
    return unitResult;
  }

  public static getStandardPrice(props: {
    pricing: InternalLocationPricing;
    discountGroup?: InternalDiscountGroup;
    result: PricingResult;
  }): PricingUnitResult {
    const unitResult = { ...DefaultPricingResult.standard };
    const { pricing, discountGroup, result } = props;
    const standardPrice = result.isNightly
      ? pricing.nightlyPrice
      : pricing.standardPrice;

    unitResult.price = standardPrice;
    if (discountGroup && discountGroup.isStandardIncluded) {
      // 퍼센티지 할인
      if (discountGroup.ratioPriceDiscount) {
        unitResult.discount =
          unitResult.price * (discountGroup.ratioPriceDiscount / 100);
      }

      // 정적 할인
      if (discountGroup.staticPriceDiscount) {
        unitResult.discount += discountGroup.staticPriceDiscount;
        if (unitResult.discount > unitResult.price) {
          unitResult.discount = unitResult.price;
        }
      }
    }

    unitResult.total = unitResult.price - unitResult.discount;
    return unitResult;
  }

  public static getSurchargePrice(props: {
    pricing: InternalLocationPricing;
    discountGroup?: InternalDiscountGroup;
    result: PricingResult;
    profile: InternalLocationProfile;
  }): PricingUnitResult {
    const unitResult = { ...DefaultPricingResult.surcharge };
    const { pricing, discountGroup, result, profile } = props;
    if (!profile.hasSurcharge) return unitResult;

    unitResult.price = pricing.surchargePrice;
    if (discountGroup && discountGroup.isSurchargeIncluded) {
      // 퍼센티지 할인
      if (discountGroup.ratioPriceDiscount) {
        unitResult.discount =
          unitResult.price * (discountGroup.ratioPriceDiscount / 100);
      }

      // 정적 할인
      if (discountGroup.staticPriceDiscount && result.standard.total === 0) {
        const discountPrice =
          discountGroup.staticPriceDiscount - result.standard.discount;

        unitResult.discount += discountPrice;
        if (unitResult.discount > unitResult.price) {
          unitResult.discount = unitResult.price;
        }
      }
    }

    unitResult.total = unitResult.price - unitResult.discount;
    return unitResult;
  }

  public static isNightly(): boolean {
    // const hour = dayjs().hour();
    // return hour > 0 && hour < 6;
    return false;
  }
}
