export type SlotStatus = "available" | "booked" | "blocked";

export type AppointmentSlot = {
  id: string;
  date: string;
  startTime: string;
  duration: number;
  service: string;
  status: SlotStatus;
  blockedReason?: string;
  blockedStartTime?: string;
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
