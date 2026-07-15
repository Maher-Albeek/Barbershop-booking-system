export type SlotStatus = "available" | "booked" | "blocked";
export type BookingStatus = "booked" | "completed" | "cancelled" | "noShow";

export type AppointmentSlot = {
  id: string;
  date: string;
  startTime: string;
  duration: number;
  service: string;
  status: SlotStatus;
  blockedReason?: string;
  blockedStartDate?: string;
  blockedStartTime?: string;
  blockedEndDate?: string;
  blockedEndTime?: string;
};

export type Booking = {
  id: string;
  slotId: string;
  service: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  message?: string;
  createdAt: string;
  updatedAt?: string;
  status: BookingStatus;
  cancelledAt?: string;
  cancelledBy?: string;
  cancellationReason?: string;
  completedAt?: string;
  noShowAt?: string;
  updatedBy?: string;
};

export type SiteImage = {
  id: string;
  src: string;
  pathname?: string;
  alt: string;
  label: string;
  createdAt: string;
};

export type ServiceItem = {
  id: string;
  title: string;
  description: string;
  duration: string;
  price: string;
};
