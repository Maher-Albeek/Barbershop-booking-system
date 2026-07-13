import { type CSSProperties, useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { CheckCircle2, Clock, Mail, MapPin, MessageCircle, Scissors, ShieldCheck } from "lucide-react";
import Stack from "../components/Stack";
import { createBooking, defaultHeroImage, formatGermanDate, getGalleryImages, getHeroImage, getServices, getSlots } from "../lib/storage";

const bookingSchema = z.object({
  customerName: z.string().min(2, "Bitte vollständigen Namen eingeben."),
  customerEmail: z.string().email("Bitte gültige E-Mail eingeben."),
  customerPhone: z.string().optional(),
  slotId: z.string().min(1, "Bitte einen Termin wählen."),
  message: z.string().optional(),
  privacy: z.boolean().refine((value) => value, "Datenschutz muss akzeptiert werden."),
});

type BookingForm = z.infer<typeof bookingSchema>;

export default function HomePage() {
  const queryClient = useQueryClient();
  const [bookingNotice, setBookingNotice] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const { data: slots = [] } = useQuery({ queryKey: ["slots"], queryFn: getSlots });
  const { data: galleryImages = [] } = useQuery({ queryKey: ["galleryImages"], queryFn: getGalleryImages });
  const { data: heroImage } = useQuery({ queryKey: ["heroImage"], queryFn: getHeroImage });
  const { data: services = [] } = useQuery({ queryKey: ["services"], queryFn: getServices });
  const availableSlots = useMemo(
    () => slots.filter((slot) => slot.status === "available").sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`)),
    [slots],
  );
  const bookableDates = useMemo(() => Array.from(new Set(slots.map((slot) => slot.date))).sort(), [slots]);
  const slotsForSelectedDate = useMemo(
    () => availableSlots.filter((slot) => slot.date === selectedDate),
    [availableSlots, selectedDate],
  );
  const galleryStackCards = useMemo(() => {
    if (galleryImages.length === 0) {
      return [];
    }

    return galleryImages.map((image) => (
      <div key={image.id} className="gallery-stack-card">
        <img src={image.src} alt={image.alt} loading="lazy" />
      </div>
    ));
  }, [galleryImages]);
  const galleryMasonryCards = useMemo(() => {
    if (galleryImages.length === 0) {
      return [];
    }

    return galleryImages.map((image) => (
      <figure key={image.id} className="gallery-masonry-card">
        <img src={image.src} alt={image.alt} loading="lazy" />
      </figure>
    ));
  }, [galleryImages]);

  const bookingForm = useForm<BookingForm>({
    resolver: zodResolver(bookingSchema),
    defaultValues: { customerName: "", customerEmail: "", customerPhone: "", slotId: "", message: "", privacy: false },
  });

  useEffect(() => {
    if (bookableDates.length > 0 && (!selectedDate || !bookableDates.includes(selectedDate))) {
      setSelectedDate(bookableDates[0]);
    }
  }, [bookableDates, selectedDate]);

  async function reserveAppointment(data: BookingForm) {
    try {
      const booking = await createBooking({
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
      <section
        className="hero"
        id="home"
        style={{ "--hero-image": `url("${heroImage?.src ?? defaultHeroImage}")` } as CSSProperties}
      >
        <div className="hero-content">
          <h1>Adem</h1>
          <a className="primary-action" href="#booking">
            <span className="primary-action-text">Reservieren</span>
            <span className="primary-action-icon" aria-hidden="true">
              <Scissors className="primary-action-glyph" size={18} strokeWidth={2.4} />
            </span>
            <span className="primary-action-overlay" aria-hidden="true" />
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
          <span>Mo-Fr 09:00-19:00</span>
        </div>
        <div>
          <Mail size={22} />
          <span>info@barber-booking.de</span>
        </div>
      </section>

      <section className="section services-section" id="services">
        <div className="section-heading">
          <p className="eyebrow">Services</p>
          <h2>Saubere Cuts, klare Linien und gepflegter Look</h2>
        </div>
        <div className="services-grid">
          {services.map((service) => (
            <article key={service.id} className="service-card">
              <span className="service-card-title">{service.title}</span>
              <div className="service-card-details">
                <strong>{service.price}</strong>
                <p>{service.description}</p>
                <span>Dauer</span> <span>{service.duration}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="section" id="gallery">
        <div className="section-heading">
          <p className="eyebrow">Galerie</p>
          <h2>Unsere Arbeiten – Präzision, Stil und perfekte Ergebnisse</h2>
        </div>
        {galleryStackCards.length > 0 ? (
          <>
            <div className="gallery-masonry">{galleryMasonryCards}</div>
            <div className="gallery-stack">
              <Stack
                cards={galleryStackCards}
                randomRotation
                sensitivity={70}
                mobileBreakpoint={561}
                animationConfig={{ stiffness: 260, damping: 24 }}
              />
            </div>
          </>
        ) : null}
      </section>

      <section className="section booking-layout" id="booking">
        <div className="booking-copy">
          <p className="eyebrow">Terminbuchung</p>
          <h2>Verfügbare Termine</h2>
          <p>Termine sind automatisch von Montag bis Freitag im aktuellen Monat und in den naechsten 3 Monaten verfuegbar.</p>
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
          <div className="date-time-grid">
            <label>
              Date *
              <input
                type="date"
                value={selectedDate}
                min={bookableDates[0]}
                max={bookableDates[bookableDates.length - 1]}
                onChange={(event) => {
                  setSelectedDate(event.target.value);
                  bookingForm.setValue("slotId", "", { shouldValidate: true });
                }}
              />
            </label>
            <label>
              Time *
              <select {...bookingForm.register("slotId")} disabled={!selectedDate || slotsForSelectedDate.length === 0}>
                <option value="">{slotsForSelectedDate.length > 0 ? "Uhrzeit wählen" : "Keine Termine"}</option>
                {slotsForSelectedDate.map((slot) => (
                  <option key={slot.id} value={slot.id}>
                    {slot.startTime} Uhr
                  </option>
                ))}
              </select>
              <small>{bookingForm.formState.errors.slotId?.message}</small>
            </label>
          </div>
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

    </>
  );
}
