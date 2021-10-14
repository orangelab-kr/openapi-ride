import { WrapperResult, WrapperResultLazyProps } from '.';

export function $_$(
  opcode: number,
  statusCode: number,
  message?: string,
  reportable?: boolean
): (props?: WrapperResultLazyProps) => WrapperResult {
  return (lazyOptions: WrapperResultLazyProps = {}) =>
    new WrapperResult({
      opcode,
      statusCode,
      message,
      reportable,
      ...lazyOptions,
    });
}

export const RESULT = {
  /** SAME ERRORS  */
  SUCCESS: $_$(0, 200),
  REQUIRED_ACCESS_KEY: $_$(-501, 401, 'REQUIRED_ACCESS_KEY'),
  EXPIRED_ACCESS_KEY: $_$(-502, 401, 'EXPIRED_ACCESS_KEY'),
  PERMISSION_DENIED: $_$(-503, 403, 'PERMISSION_DENIED'),
  INVALID_ERROR: $_$(-504, 500, 'INVALID_ERROR', true),
  FAILED_VALIDATE: $_$(-505, 400, 'FAILED_VALIDATE'),
  INVALID_API: $_$(-506, 404, 'INVALID_API'),
  /** CUSTOM ERRORS  */
  CANNOT_FIND_PAYMENT: $_$(-507, 404, 'CANNOT_FIND_PAYMENT'),
  INVALID_TERMINATE_TIME: $_$(-508, 400, 'INVALID_TERMINATE_TIME'),
  ALREADY_USING_KICKBOARD: $_$(-509, 400, 'ALREADY_USING_KICKBOARD'),
  PHOTO_UPLOAD_NOT_TERMINATE: $_$(-510, 400, 'PHOTO_UPLOAD_NOT_TERMINATE'),
  PHOTO_UPLOAD_TIMEOUT: $_$(-511, 400, 'PHOTO_UPLOAD_TIMEOUT'),
  ALREADY_PHOTO_UPLOAD: $_$(-512, 409, 'ALREADY_PHOTO_UPLOAD'),
  ALREADY_TERMINATED_RIDE: $_$(-513, 409, 'ALREADY_TERMINATED_RIDE'),
  CANNOT_FIND_RIDE: $_$(-514, 404, 'CANNOT_FIND_RIDE'),
};
