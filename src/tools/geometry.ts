import { S2LatLng, S2LatLngRect } from 'nodes2ts';

export class Geometry {
  public static getRect(props: { lat: number; lng: number; radius: number }): {
    low: { lat: number; lng: number };
    high: { lat: number; lng: number };
  } {
    const centerLatLng = S2LatLng.fromDegrees(props.lat, props.lng);
    const latReferenceUnit = props.lat > 0.0 ? -1.0 : 1.0;
    const latReferenceLatLng = S2LatLng.fromDegrees(
      props.lat + latReferenceUnit,
      props.lng
    );

    const lngReferenceUnit = props.lng > 0.0 ? -1.0 : 1.0;
    const lngReferenceLatLng = S2LatLng.fromDegrees(
      props.lat,
      props.lng + lngReferenceUnit
    );

    const latForRadius =
      props.radius / centerLatLng.getEarthDistance(latReferenceLatLng);
    const lngForRadius =
      props.radius / centerLatLng.getEarthDistance(lngReferenceLatLng);

    const minLatLng = S2LatLng.fromDegrees(
      props.lat - latForRadius,
      props.lng - lngForRadius
    );

    const maxLatLng = S2LatLng.fromDegrees(
      props.lat + latForRadius,
      props.lng + lngForRadius
    );

    const rect = S2LatLngRect.fromLatLng(minLatLng, maxLatLng);
    const lo = rect.lo();
    const hi = rect.hi();

    return {
      low: {
        lat: parseFloat(lo.latDegrees.toFixed(5)),
        lng: parseFloat(lo.lngDegrees.toFixed(5)),
      },
      high: {
        lat: parseFloat(hi.latDegrees.toFixed(5)),
        lng: parseFloat(hi.lngDegrees.toFixed(5)),
      },
    };
  }

  public static getDistance(
    firstLoc: { lat: number; lng: number },
    secondLoc: { lat: number; lng: number }
  ): number {
    const firstLatLng = S2LatLng.fromDegrees(firstLoc.lat, firstLoc.lng);
    const secondLatLng = S2LatLng.fromDegrees(secondLoc.lat, secondLoc.lng);
    return firstLatLng.getEarthDistance(secondLatLng);
  }
}
