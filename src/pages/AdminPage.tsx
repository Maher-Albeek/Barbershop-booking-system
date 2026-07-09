import { FormEvent, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, ImagePlus, LogOut, Trash2 } from "lucide-react";
import {
  addGalleryImage,
  blockSlotRange,
  convertImageFileToAvif,
  defaultHeroImage,
  deleteGalleryImage,
  deleteHeroImage,
  formatGermanDate,
  getBlockEndTimes,
  getBookings,
  getGalleryImages,
  getHeroImage,
  getSlots,
  getWorkingTimes,
  isAdminAuthenticated,
  loginAdmin,
  logoutAdmin,
  saveHeroImage,
  unblockSlot,
} from "../lib/storage";

const emptyBlockedTime = {
  date: new Date().toISOString().slice(0, 10),
  startTime: "09:00",
  endTime: "10:00",
};

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function addMinutes(time: string, duration: number) {
  const totalMinutes = timeToMinutes(time) + duration;
  const hours = Math.floor(totalMinutes / 60)
    .toString()
    .padStart(2, "0");
  const minutes = (totalMinutes % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

export default function AdminPage() {
  const queryClient = useQueryClient();
  const [authenticated, setAuthenticated] = useState(isAdminAuthenticated);
  const [loginError, setLoginError] = useState("");
  const [blockError, setBlockError] = useState("");
  const [imageMessage, setImageMessage] = useState("");
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [blockedTimeForm, setBlockedTimeForm] = useState(emptyBlockedTime);
  const { data: slots = [] } = useQuery({ queryKey: ["slots"], queryFn: getSlots });
  const { data: bookings = [] } = useQuery({ queryKey: ["bookings"], queryFn: getBookings });
  const { data: galleryImages = [] } = useQuery({ queryKey: ["galleryImages"], queryFn: getGalleryImages });
  const { data: heroImage } = useQuery({ queryKey: ["heroImage"], queryFn: getHeroImage });
  const workingTimes = getWorkingTimes();
  const blockEndTimes = getBlockEndTimes();
  const endTimeOptions = blockEndTimes.filter((time) => timeToMinutes(time) > timeToMinutes(blockedTimeForm.startTime));
  const blockedSlots = slots
    .filter((slot) => slot.status === "blocked")
    .sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`));
  const bookedSlots = slots.filter((slot) => slot.status === "booked");

  function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email"));
    const password = String(data.get("password"));
    const valid = loginAdmin(email, password);
    setAuthenticated(valid);
    setLoginError(valid ? "" : "Login fehlgeschlagen. Demo: admin@barber.local / Barber2026!");
  }

  function saveBlockedTime(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (timeToMinutes(blockedTimeForm.endTime) <= timeToMinutes(blockedTimeForm.startTime)) {
      setBlockError("Endzeit muss nach der Startzeit liegen.");
      return;
    }

    blockSlotRange(blockedTimeForm);
    setBlockError("");
    setBlockedTimeForm(emptyBlockedTime);
    queryClient.invalidateQueries({ queryKey: ["slots"] });
  }

  async function uploadHeroImage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const file = data.get("heroImage");
    if (!(file instanceof File) || file.size === 0) return;

    try {
      setIsUploadingImage(true);
      setImageMessage("");
      const src = await convertImageFileToAvif(file);
      saveHeroImage({ src, alt: "Barbershop Hero" });
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["heroImage"] });
      setImageMessage("Hero-Bild wurde als AVIF gespeichert.");
    } catch (error) {
      setImageMessage(error instanceof Error ? error.message : "Bild konnte nicht gespeichert werden.");
    } finally {
      setIsUploadingImage(false);
    }
  }

  async function uploadGalleryImage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const file = data.get("galleryImage");
    const label = String(data.get("label") || "Galerie");
    const alt = String(data.get("alt") || label);
    if (!(file instanceof File) || file.size === 0) return;

    try {
      setIsUploadingImage(true);
      setImageMessage("");
      const src = await convertImageFileToAvif(file, 1200);
      addGalleryImage({ src, alt, label });
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["galleryImages"] });
      setImageMessage("Galerie-Bild wurde als AVIF gespeichert.");
    } catch (error) {
      setImageMessage(error instanceof Error ? error.message : "Bild konnte nicht gespeichert werden.");
    } finally {
      setIsUploadingImage(false);
    }
  }

  if (!authenticated) {
    return (
      <section className="section admin-login">
        <form className="form-panel login-panel" onSubmit={handleLogin}>
          <p className="eyebrow">Admin Login</p>
          <h1>Geschuetzter Bereich</h1>
          <label>
            Email
            <input name="email" type="email" defaultValue="admin@barber.local" />
          </label>
          <label>
            Password
            <input name="password" type="password" defaultValue="Barber2026!" />
          </label>
          <button type="submit">Login</button>
          {loginError && <p className="error-message">{loginError}</p>}
        </form>
      </section>
    );
  }

  return (
    <section className="section admin-page">
      <div className="admin-topbar">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>Termine verwalten</h1>
        </div>
        <button
          type="button"
          className="secondary-button"
          onClick={() => {
            logoutAdmin();
            setAuthenticated(false);
          }}
        >
          <LogOut size={18} />
          Logout
        </button>
      </div>

      <div className="admin-grid">
        <form className="form-panel" onSubmit={saveBlockedTime}>
          <h2>Zeit blockieren</h2>
          <label>
            Datum
            <input
              type="date"
              value={blockedTimeForm.date}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(event) => setBlockedTimeForm({ ...blockedTimeForm, date: event.target.value })}
            />
          </label>
          <label>
            Startzeit
            <select
              value={blockedTimeForm.startTime}
              onChange={(event) => {
                const startTime = event.target.value;
                const nextEndTime =
                  timeToMinutes(blockedTimeForm.endTime) > timeToMinutes(startTime) ? blockedTimeForm.endTime : addMinutes(startTime, 60);
                setBlockedTimeForm({ ...blockedTimeForm, startTime, endTime: nextEndTime });
              }}
            >
              {workingTimes.map((time) => (
                <option key={time} value={time}>
                  {time} Uhr
                </option>
              ))}
            </select>
          </label>
          <label>
            Endzeit
            <select
              value={blockedTimeForm.endTime}
              onChange={(event) => setBlockedTimeForm({ ...blockedTimeForm, endTime: event.target.value })}
            >
              {endTimeOptions.map((time) => (
                <option key={time} value={time}>
                  {time} Uhr
                </option>
              ))}
            </select>
          </label>
          {blockError && <p className="error-message">{blockError}</p>}
          <button type="submit">
            <Ban size={18} />
            Blockieren
          </button>
        </form>

        <div className="panel">
          <h2>Blockierte Zeiten</h2>
          <div className="table-list">
            {blockedSlots.length === 0 ? <p>Keine Zeiten blockiert.</p> : null}
            {blockedSlots.map((slot) => (
              <article key={slot.id} className="slot-row">
                <div>
                  <strong>
                    {formatGermanDate(slot.date, slot.startTime)} · {slot.startTime} - {addMinutes(slot.startTime, slot.duration)}
                  </strong>
                  <span>Fuer Kunden nicht buchbar</span>
                </div>
                <div className="row-actions">
                  <button
                    type="button"
                    aria-label="Blockierung entfernen"
                    onClick={() => {
                      unblockSlot(slot.id);
                      queryClient.invalidateQueries({ queryKey: ["slots"] });
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>

      <div className="admin-grid">
        <form className="form-panel" onSubmit={uploadHeroImage}>
          <h2>Hero-Bild</h2>
          <div className="admin-image-preview">
            <img src={heroImage?.src ?? defaultHeroImage} alt={heroImage?.alt ?? "Barbershop Hero"} />
          </div>
          <label>
            Bild hochladen
            <input name="heroImage" type="file" accept="image/*" />
          </label>
          <button type="submit" disabled={isUploadingImage}>
            <ImagePlus size={18} />
            Als AVIF speichern
          </button>
          {heroImage ? (
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                deleteHeroImage();
                queryClient.invalidateQueries({ queryKey: ["heroImage"] });
              }}
            >
              <Trash2 size={16} />
              Hero loeschen
            </button>
          ) : null}
        </form>

        <div className="panel">
          <form className="admin-media-form" onSubmit={uploadGalleryImage}>
            <h2>Galerie-Bild</h2>
            <label>
              Bild hochladen
              <input name="galleryImage" type="file" accept="image/*" />
            </label>
            <label>
              Titel
              <input name="label" placeholder="Classic Fade" />
            </label>
            <label>
              Alt Text
              <input name="alt" placeholder="Haarschnitt Ergebnis im Barbershop" />
            </label>
            <button type="submit" disabled={isUploadingImage}>
              <ImagePlus size={18} />
              Als AVIF speichern
            </button>
            {imageMessage ? <p className={imageMessage.includes("AVIF gespeichert") ? "success-message" : "error-message"}>{imageMessage}</p> : null}
          </form>

          <div className="admin-gallery-list">
            {galleryImages.map((image) => (
              <article key={image.id} className="admin-gallery-row">
                <img src={image.src} alt={image.alt} />
                <div>
                  <strong>{image.label}</strong>
                  <span>{image.createdAt === "default" ? "Standardbild" : "AVIF Upload"}</span>
                </div>
                <button
                  type="button"
                  aria-label="Galerie-Bild loeschen"
                  onClick={() => {
                    deleteGalleryImage(image.id);
                    queryClient.invalidateQueries({ queryKey: ["galleryImages"] });
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </article>
            ))}
          </div>
        </div>
      </div>

      <div className="admin-grid">
        <div className="panel">
          <h2>Neue Terminbuchung</h2>
          {bookings.length === 0 ? <p>Noch keine Buchungen.</p> : null}
          {bookings.map((booking) => {
            const slot = bookedSlots.find((item) => item.id === booking.slotId) ?? slots.find((item) => item.id === booking.slotId);
            return (
              <article key={booking.id} className="notification-box">
                <strong>Name: {booking.customerName}</strong>
                <span>Email: {booking.customerEmail}</span>
                <span>Datum: {slot ? formatGermanDate(slot.date, slot.startTime) : "Slot geloescht"}</span>
                <span>Uhrzeit: {slot?.startTime ?? "-"} Uhr</span>
              </article>
            );
          })}
        </div>
        <div className="panel">
          <h2>Telegram Vorlage</h2>
          <div className="notification-box">
            <strong>Neue Buchung</strong>
            <span>Max Mustermann</span>
            <span>10.08.2026</span>
            <span>14:00 Uhr</span>
          </div>
        </div>
      </div>
    </section>
  );
}
