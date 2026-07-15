import { lazy, memo, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { CheckCircle2, Clock, Mail, MapPin, MessageCircle, Scissors, ShieldCheck } from "lucide-react";
import { ResponsiveImage } from "../components/ResponsiveImage";
import { createBooking, defaultHeroImage, formatGermanDate, getPublicSiteData } from "../lib/storage";
import type { SiteImage } from "../lib/types";

const bookingSchema = z.object({
  customerName: z.string().min(2, "Bitte vollständigen Namen eingeben."),
  customerEmail: z.string().email("Bitte gültige E-Mail eingeben."),
  customerPhone: z.string().optional(),
  service: z.string().min(1, "Bitte einen Service waehlen."),
  slotId: z.string().min(1, "Bitte einen Termin wählen."),
  message: z.string().optional(),
  privacy: z.boolean().refine((value) => value, "Datenschutz muss akzeptiert werden."),
});

type BookingForm = z.infer<typeof bookingSchema>;

const stackAnimationConfig = { stiffness: 260, damping: 24 };
const Stack = lazy(() => import("../components/Stack"));

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => (typeof window === "undefined" ? false : window.matchMedia(query).matches));

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    const updateMatches = () => setMatches(mediaQuery.matches);
    updateMatches();
    mediaQuery.addEventListener("change", updateMatches);
    return () => mediaQuery.removeEventListener("change", updateMatches);
  }, [query]);

  return matches;
}

function useNearViewport<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [isNearViewport, setIsNearViewport] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || isNearViewport) return;
    if (!("IntersectionObserver" in window)) {
      setIsNearViewport(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsNearViewport(true);
          observer.disconnect();
        }
      },
      { rootMargin: "420px 0px" },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [isNearViewport]);

  return [ref, isNearViewport] as const;
}

const GalleryStackCard = memo(function GalleryStackCard({ image }: { image: SiteImage }) {
  return (
    <div className="gallery-stack-card">
      <ResponsiveImage
        src={image.src}
        alt={image.alt}
        sizes="(max-width: 560px) min(100vw - 28px, 340px), 440px"
        widths={[320, 480, 680, 900]}
        width={680}
        height={850}
      />
    </div>
  );
});

const GalleryMasonryCard = memo(function GalleryMasonryCard({ image }: { image: SiteImage }) {
  return (
    <figure className="gallery-masonry-card">
      <ResponsiveImage
        src={image.src}
        alt={image.alt}
        sizes="(max-width: 860px) calc(100vw - 40px), 32vw"
        widths={[360, 560, 760, 1000]}
        width={760}
        height={950}
      />
    </figure>
  );
});

export default function HomePage() {
  const queryClient = useQueryClient();
  const [bookingNotice, setBookingNotice] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [galleryRef, isGalleryNearViewport] = useNearViewport<HTMLElement>();
  const isMobile = useMediaQuery("(max-width: 560px)");
  const { data: siteData } = useQuery({
    queryKey: ["publicSiteData"],
    queryFn: getPublicSiteData,
    staleTime: 60_000,
  });
  const slots = siteData?.slots ?? [];
  const galleryImages = siteData?.galleryImages ?? [];
  const heroImage = siteData?.heroImage ?? null;
  const services = siteData?.services ?? [];
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

    return galleryImages.map((image) => <GalleryStackCard key={image.id} image={image} />);
  }, [galleryImages]);
  const galleryMasonryCards = useMemo(() => {
    if (galleryImages.length === 0) {
      return [];
    }

    return galleryImages.map((image) => <GalleryMasonryCard key={image.id} image={image} />);
  }, [galleryImages]);

  const bookingForm = useForm<BookingForm>({
    resolver: zodResolver(bookingSchema),
    defaultValues: { customerName: "", customerEmail: "", customerPhone: "", service: "", slotId: "", message: "", privacy: false },
  });

  useEffect(() => {
    if (bookableDates.length > 0 && (!selectedDate || !bookableDates.includes(selectedDate))) {
      setSelectedDate(bookableDates[0]);
    }
  }, [bookableDates, selectedDate]);

  const updateSelectedDate = useCallback(
    (date: string) => {
      setSelectedDate((current) => (current === date ? current : date));
      bookingForm.setValue("slotId", "", { shouldValidate: true });
    },
    [bookingForm],
  );

  async function reserveAppointment(data: BookingForm) {
    try {
      const booking = await createBooking({
        slotId: data.slotId,
        service: data.service,
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
      queryClient.invalidateQueries({ queryKey: ["publicSiteData"] });
    } catch (error) {
      setBookingNotice(error instanceof Error ? error.message : "Buchung fehlgeschlagen.");
    }
  }

  return (
    <>
      <section className="hero" id="home">
        <ResponsiveImage
          pictureClassName="hero-media"
          src={heroImage?.src ?? defaultHeroImage}
          alt={heroImage?.alt ?? "Adem Barbershop"}
          sizes="100vw"
          widths={[560, 860, 1200, 1600, 2200]}
          width={1600}
          height={1000}
          loading="eager"
          fetchPriority="high"
        />
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

      <div className="content-background">
        <div className="content-background-shade" aria-hidden="true" />

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

      <section className="section" id="gallery" ref={galleryRef}>
        <div className="section-heading">
          <p className="eyebrow">Galerie</p>
          <h2>Unsere Arbeiten – Präzision, Stil und perfekte Ergebnisse</h2>
        </div>
        {galleryStackCards.length > 0 ? (
          <>
            <div className="gallery-masonry">{galleryMasonryCards}</div>
            {isMobile && isGalleryNearViewport ? (
              <div className="gallery-stack">
                <Suspense fallback={null}>
                  <Stack
                    cards={galleryStackCards}
                    randomRotation
                    sensitivity={70}
                    mobileBreakpoint={561}
                    animationConfig={stackAnimationConfig}
                  />
                </Suspense>
              </div>
            ) : null}
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
          <label>
            Service *
            <select {...bookingForm.register("service")}>
              <option value="">Service waehlen</option>
              {services.map((service) => (
                <option key={service.id} value={service.title}>
                  {service.title}
                </option>
              ))}
            </select>
            <small>{bookingForm.formState.errors.service?.message}</small>
          </label>
          <div className="date-time-grid">
            <label>
              Date *
              <input
                type="date"
                value={selectedDate}
                min={bookableDates[0]}
                max={bookableDates[bookableDates.length - 1]}
                onChange={(event) => updateSelectedDate(event.target.value)}
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
      </div>

    </>
  );
}
