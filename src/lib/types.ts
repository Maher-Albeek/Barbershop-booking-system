export type SlotStatus = "available" | "booked" | "blocked";

export type AppointmentSlot = {
  id: string;
  date: string;
  startTime: string;
  duration: number;
  service: string;
  status: SlotStatus;
};

export type Booking = {
  id: string;
  slotId: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  message?: string;
  createdAt: string;
};

export type SiteImage = {
  id: string;
  src: string;
  alt: string;
  label: string;
  createdAt: string;
};
