import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { CheckCircle2, Clock, Mail, MapPin, MessageCircle, ShieldCheck } from "lucide-react";
import { createBooking, formatGermanDate, getSlots } from "../lib/storage";

const bookingSchema = z.object({
  customerName: z.string().min(2, "Bitte vollständigen Namen eingeben."),
  customerEmail: z.string().email("Bitte gültige E-Mail eingeben."),
  customerPhone: z.string().optional(),
  slotId: z.string().min(1, "Bitte einen Termin wählen."),
  message: z.string().optional(),
  privacy: z.boolean().refine((value) => value, "Datenschutz muss akzeptiert werden."),
});

type BookingForm = z.infer<typeof bookingSchema>;

const galleryImages = [
  {
    src: "https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&w=900&q=80",
    alt: "Barber schneidet Haare im Salon",
    label: "Classic Fade",
  },
  {
    src: "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?auto=format&fit=crop&w=900&q=80",
    alt: "Bartpflege mit Rasiermesser",
    label: "Beard Trim",
  },
  {
    src: "https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=900&q=80",
    alt: "Moderner Barbershop Innenraum",
    label: "Shop",
  },
  {
    src: "https://images.unsplash.com/photo-1517832606299-7ae9b720a186?auto=format&fit=crop&w=900&q=80",
    alt: "Styling Ergebnis nach Haarschnitt",
    label: "Before / After",
  },
];

export default function HomePage() {
  const queryClient = useQueryClient();
  const [selectedImage, setSelectedImage] = useState<(typeof galleryImages)[number] | null>(null);
  const [bookingNotice, setBookingNotice] = useState("");
  const { data: slots = [] } = useQuery({ queryKey: ["slots"], queryFn: getSlots });
  const availableSlots = useMemo(
    () => slots.filter((slot) => slot.status === "available").sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`)),
    [slots],
  );

  const bookingForm = useForm<BookingForm>({
    resolver: zodResolver(bookingSchema),
    defaultValues: { customerName: "", customerEmail: "", customerPhone: "", slotId: "", message: "", privacy: false },
  });

  function reserveAppointment(data: BookingForm) {
    try {
      const booking = createBooking({
        slotId: data.slotId,
        customerName: data.customerName,
        customerEmail: data.customerEmail,
        customerPhone: data.customerPhone,
        message: data.message,
      });
      const slot = slots.find((item) => item.id === booking.slotId);
      setBookingNotice(
        `Termin reserviert. Neue Terminbuchung: ${booking.customerName}, ${slot ? `${formatGermanDate(slot.date, slot.startTime)} um ${slot.startTime} Uhr` : ""}.`,
      );
      bookingForm.reset();
      queryClient.invalidateQueries({ queryKey: ["slots"] });
    } catch (error) {
      setBookingNotice(error instanceof Error ? error.message : "Buchung fehlgeschlagen.");
    }
  }

  return (
    <>
      <section className="hero" id="home">
        <div className="hero-content">
          <h1>Adem</h1>
          <a className="primary-action" href="#booking">
            Reservieren
          </a>
        </div>
      </section>

      <section className="info-band" aria-label="Standort und Öffnungszeiten">
        <div>
          <MapPin size={22} />
          <span>Hauptstraße 12, 10115 Berlin</span>
        </div>
        <div>
          <Clock size={22} />
          <span>Mo-Sa 09:00-19:00</span>
        </div>
        <div>
          <Mail size={22} />
          <span>info@barber-booking.de</span>
        </div>
      </section>

      <section className="section" id="gallery">
        <div className="section-heading">
          <p className="eyebrow">Galerie</p>
          <h2>AVIF-ready Bilder für Leistungen und Before/After</h2>
        </div>
        <div className="gallery-grid">
          {galleryImages.map((image) => (
            <button key={image.src} type="button" className="gallery-item" onClick={() => setSelectedImage(image)}>
              <img src={image.src} alt={image.alt} loading="lazy" />
              <span>{image.label}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="section booking-layout" id="booking">
        <div className="booking-copy">
          <p className="eyebrow">Terminbuchung</p>
          <h2>Verfügbare Termine</h2>
          <p>Nur freie und zukünftige Slots werden angezeigt. Nach der Reservierung wird der Slot sofort blockiert.</p>
          <div className="trust-list">
            <span>
              <ShieldCheck size={18} /> Datenschutz-Checkbox
            </span>
            <span>
              <CheckCircle2 size={18} /> Double Booking verhindert
            </span>
            <span>
              <MessageCircle size={18} /> Telegram-Benachrichtigung vorbereitet
            </span>
          </div>
        </div>

        <form className="form-panel" onSubmit={bookingForm.handleSubmit(reserveAppointment)}>
          <label>
            Full Name *
            <input {...bookingForm.register("customerName")} placeholder="Max Mustermann" />
            <small>{bookingForm.formState.errors.customerName?.message}</small>
          </label>
          <label>
            Email *
            <input {...bookingForm.register("customerEmail")} type="email" placeholder="max@test.de" />
            <small>{bookingForm.formState.errors.customerEmail?.message}</small>
          </label>
          <label>
            Phone
            <input {...bookingForm.register("customerPhone")} type="tel" placeholder="+49 ..." />
          </label>
          <label>
            Date / Time *
            <select {...bookingForm.register("slotId")}>
              <option value="">Termin wählen</option>
              {availableSlots.map((slot) => (
                <option key={slot.id} value={slot.id}>
                  {formatGermanDate(slot.date, slot.startTime)} · {slot.startTime} Uhr · {slot.service} · {slot.duration} Min.
                </option>
              ))}
            </select>
            <small>{bookingForm.formState.errors.slotId?.message}</small>
          </label>
          <label>
            Message
            <textarea {...bookingForm.register("message")} rows={3} placeholder="Optionaler Hinweis" />
          </label>
          <label className="checkbox-row">
            <input type="checkbox" {...bookingForm.register("privacy")} />
            Datenschutz akzeptieren *
          </label>
          <small>{bookingForm.formState.errors.privacy?.message}</small>
          <button type="submit">Termin reservieren</button>
          {bookingNotice && <p className="success-message">{bookingNotice}</p>}
        </form>
      </section>

      {selectedImage && (
        <div className="lightbox" role="dialog" aria-modal="true" onClick={() => setSelectedImage(null)}>
          <button type="button" aria-label="Lightbox schließen">
            ×
          </button>
          <img src={selectedImage.src} alt={selectedImage.alt} />
        </div>
      )}
    </>
  );
}
