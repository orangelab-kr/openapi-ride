import {
  BorrowedHelmetModel,
  BorrowedHelmetStatus,
  RideModel,
} from '@prisma/client';
import { InternalClient, Joi, prisma, RESULT } from '..';

export class BorrowedHelmet {
  public static async getCurrentBorrowedHelmet(
    ride: RideModel
  ): Promise<BorrowedHelmetModel | null> {
    const { rideId } = ride;
    const status = { not: BorrowedHelmetStatus.RETURNED };
    return prisma.borrowedHelmetModel.findFirst({
      where: { rideId, status },
      orderBy: { createdAt: 'desc' },
    });
  }

  public static async getCurrentBorrowedHelmetOrThrow(
    ride: RideModel
  ): Promise<BorrowedHelmetModel> {
    const borrowedHelmet = await BorrowedHelmet.getCurrentBorrowedHelmet(ride);
    if (!borrowedHelmet) throw RESULT.NOT_BORROWED_HELMET();
    return borrowedHelmet;
  }

  public static async getHelmetCredentials(ride: RideModel): Promise<any> {
    const { kickboardCode } = ride;
    const kickboardClient = InternalClient.getKickboard();
    const { helmetId } = await kickboardClient.getKickboard(kickboardCode);
    if (!helmetId) throw RESULT.HELMET_NOT_REGISTERED();
    const { data } = await kickboardClient.instance.get(`/helmets/${helmetId}`);
    return data.helmet;
  }

  public static async borrowHelmet(
    ride: RideModel,
    props: { deviceInfo?: string }
  ): Promise<BorrowedHelmetModel> {
    const { rideId } = ride;
    const borrowedHelmet = await BorrowedHelmet.getCurrentBorrowedHelmet(ride);
    if (borrowedHelmet) return borrowedHelmet;
    const { deviceInfo } = await Joi.object({
      deviceInfo: Joi.string().optional(),
    }).validateAsync(props);
    return prisma.borrowedHelmetModel.create({
      data: { deviceInfo, rideId },
    });
  }

  public static async borrowHelmetComplete(
    borrowedHelmet: BorrowedHelmetModel
  ): Promise<BorrowedHelmetModel> {
    const { borrowId } = borrowedHelmet;
    const status = BorrowedHelmetStatus.BORROWED;
    return prisma.borrowedHelmetModel.update({
      where: { borrowId },
      data: { status },
    });
  }

  public static async returnHelmet(
    borrowedHelmet: BorrowedHelmetModel
  ): Promise<BorrowedHelmetModel> {
    const { borrowId } = borrowedHelmet;
    return prisma.borrowedHelmetModel.update({
      where: { borrowId },
      data: { returnedAt: new Date() },
    });
  }

  public static async returnHelmetCompleted(
    borrowedHelmet: BorrowedHelmetModel
  ): Promise<BorrowedHelmetModel> {
    const { borrowId } = borrowedHelmet;
    const status = BorrowedHelmetStatus.RETURNED;
    return prisma.borrowedHelmetModel.update({
      where: { borrowId },
      data: { status },
    });
  }
}
