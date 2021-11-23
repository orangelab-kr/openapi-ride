import { RideTerminatedType } from '@prisma/client';
import { Ride } from '.';

interface LowBatteryMetrics {
  metricsId: string;
  monitorId: 'lowBattery';
  metricsData: {
    kickboard: {
      _id: string;
      kickboardId: string;
      __v: 0;
      collect: number | null;
      createdAt: string;
      franchiseId: string;
      kickboardCode: string;
      lost: number | null;
      maxSpeed: number | null;
      mode: number;
      regionId: string;
      updatedAt: string;
      photo: string;
      status: string;
      helmetId: string;
      disconnectedAt: string;
    };
    status: {
      _id: string;
      reportReason: [number];
      kickboardId: string;
      timestamp: string;
      messageNumber: number;
      gps: {
        _id: string;
        timestamp: string;
        latitude: number;
        longitude: number;
        updatedAt: string;
        satelliteUsedCount: number;
        isValid: boolean;
        speed: number;
      };
      network: {
        _id: string;
        isRoaming: boolean;
        signalStrength: number;
        mcc: number;
        mnc: number;
      };
      trip: { _id: string; time: number; distance: number };
      power: {
        _id: string;
        batteryCycle: number;
        speedLimit: number;
        scooter: {
          _id: string;
          battery: number;
          isCharging: boolean;
        };
        iot: {
          _id: string;
          battery: number;
          isCharging: boolean;
        };
      };
      isEnabled: boolean;
      isLightsOn: boolean;
      isBuzzerOn: boolean;
      isControllerChecked: boolean;
      isIotChecked: boolean;
      isBatteryChecked: boolean;
      isFallDown: boolean;
      isEBSBrakeOn: boolean;
      isKickstandOn: boolean;
      isLineLocked: boolean;
      isBatteryLocked: boolean;
      speed: number;
      createdAt: string;
      __v: 0;
    };
  };
  createdAt: string;
  updatedAt: string;
}

export class Webhook {
  public static async onLowBattery(props: LowBatteryMetrics): Promise<void> {
    const { kickboardCode } = props.metricsData.kickboard;
    const { rides } = await Ride.getRides({ take: 1, skip: 0, kickboardCode });
    if (rides.length <= 0 || rides[0].terminatedAt) return;
    await Ride.terminateRide(rides[0], {
      terminatedType: RideTerminatedType.LOW_BATTERY,
    });
  }

  public static async onSpeedChange(props: any): Promise<void> {
    const { kickboardCode } = props.kickboard;
    const { rides } = await Ride.getRides({ take: 1, skip: 0, kickboardCode });
    if (rides.length <= 0) return;
    await Ride.sendSpeedChangeWebhook(rides[0], props);
  }
}
