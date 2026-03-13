import { ReservationStatus } from '@prisma/client';

export const RESERVATION_EXPIRATION_QUEUE = 'reservation-expiration';
export const RESERVATION_EXPIRATION_JOB = 'expire-pending-reservation';

export const ACTIVE_RESERVATION_STATUSES: ReservationStatus[] = [
  ReservationStatus.PENDING,
  ReservationStatus.CONFIRMED,
  ReservationStatus.CHANGE_REQUESTED_BY_CUSTOMER,
  ReservationStatus.CHANGE_REQUESTED_BY_OWNER,
];

export const EXPIRABLE_RESERVATION_STATUSES: ReservationStatus[] = [
  ReservationStatus.PENDING,
  ReservationStatus.CHANGE_REQUESTED_BY_CUSTOMER,
  ReservationStatus.CHANGE_REQUESTED_BY_OWNER,
];

export const CUSTOMER_CANCELLABLE_RESERVATION_STATUSES: ReservationStatus[] = [
  ReservationStatus.PENDING,
  ReservationStatus.CONFIRMED,
  ReservationStatus.CHANGE_REQUESTED_BY_CUSTOMER,
  ReservationStatus.CHANGE_REQUESTED_BY_OWNER,
];

export const OWNER_CANCELLABLE_RESERVATION_STATUSES: ReservationStatus[] = [
  ReservationStatus.PENDING,
  ReservationStatus.CONFIRMED,
  ReservationStatus.CHANGE_REQUESTED_BY_CUSTOMER,
  ReservationStatus.CHANGE_REQUESTED_BY_OWNER,
];

export const CHANGE_REQUESTABLE_RESERVATION_STATUSES: ReservationStatus[] = [
  ReservationStatus.PENDING,
  ReservationStatus.CONFIRMED,
];

export const COMPLETABLE_RESERVATION_STATUSES: ReservationStatus[] = [
  ReservationStatus.CONFIRMED,
];
