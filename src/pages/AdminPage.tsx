import { FormEvent, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, LogOut, Pencil, Trash2 } from "lucide-react";
import {
  createSlot,
  deleteSlot,
  formatGermanDate,
  getBookings,
  getSlots,
  isAdminAuthenticated,
  loginAdmin,
  logoutAdmin,
  updateSlot,
} from "../lib/storage";
import type { AppointmentSlot } from "../lib/types";

const emptySlot = {
  date: new Date().toISOString().slice(0, 10),
  startTime: "10:00",
  duration: 30,
  service: "Haircut",
};

export default function AdminPage() {
  const queryClient = useQueryClient();
  const [authenticated, setAuthenticated] = useState(isAdminAuthenticated);
  const [loginError, setLoginError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [slotForm, setSlotForm] = useState(emptySlot);
  const { data: slots = [] } = useQuery({ queryKey: ["slots"], queryFn: getSlots });
  const { data: bookings = [] } = useQuery({ queryKey: ["bookings"], queryFn: getBookings });

  function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email"));
    const password = String(data.get("password"));
    const valid = loginAdmin(email, password);
    setAuthenticated(valid);
    setLoginError(valid ? "" : "Login fehlgeschlagen. Demo: admin@barber.local / Barber2026!");
  }

  function saveSlot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (editingId) {
      const existing = slots.find((slot) => slot.id === editingId);
      if (existing) updateSlot({ ...existing, ...slotForm, duration: Number(slotForm.duration) });
    } else {
      createSlot({ ...slotForm, duration: Number(slotForm.duration) });
    }
    setEditingId(null);
    setSlotForm(emptySlot);
    queryClient.invalidateQueries({ queryKey: ["slots"] });
  }

  function startEdit(slot: AppointmentSlot) {
    setEditingId(slot.id);
    setSlotForm({
      date: slot.date,
      startTime: slot.startTime,
      duration: slot.duration,
      service: slot.service,
    });
  }

  if (!authenticated) {
    return (
      <section className="section admin-login">
        <form className="form-panel login-panel" onSubmit={handleLogin}>
          <p className="eyebrow">Admin Login</p>
          <h1>Geschützter Bereich</h1>
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
        <form className="form-panel" onSubmit={saveSlot}>
          <h2>{editingId ? "Slot bearbeiten" : "Slot erstellen"}</h2>
          <label>
            Datum
            <input
              type="date"
              value={slotForm.date}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(event) => setSlotForm({ ...slotForm, date: event.target.value })}
            />
          </label>
          <label>
            Startzeit
            <input
              type="time"
              value={slotForm.startTime}
              onChange={(event) => setSlotForm({ ...slotForm, startTime: event.target.value })}
            />
          </label>
          <label>
            Dauer
            <select
              value={slotForm.duration}
              onChange={(event) => setSlotForm({ ...slotForm, duration: Number(event.target.value) })}
            >
              <option value={15}>15 Minuten</option>
              <option value={20}>20 Minuten</option>
              <option value={30}>30 Minuten</option>
              <option value={45}>45 Minuten</option>
              <option value={60}>60 Minuten</option>
            </select>
          </label>
          <label>
            Service
            <select value={slotForm.service} onChange={(event) => setSlotForm({ ...slotForm, service: event.target.value })}>
              <option>Haircut</option>
              <option>Haircut + Beard</option>
              <option>Beard</option>
              <option>Style Beratung</option>
            </select>
          </label>
          <button type="submit">
            <CalendarPlus size={18} />
            Speichern
          </button>
        </form>

        <div className="panel">
          <h2>Slots</h2>
          <div className="table-list">
            {slots.map((slot) => (
              <article key={slot.id} className="slot-row">
                <div>
                  <strong>
                    {formatGermanDate(slot.date, slot.startTime)} · {slot.startTime}
                  </strong>
                  <span>
                    {slot.service} · {slot.duration} Min. · {slot.status === "available" ? "frei" : "gebucht"}
                  </span>
                </div>
                <div className="row-actions">
                  <button type="button" aria-label="Slot bearbeiten" onClick={() => startEdit(slot)}>
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button"
                    aria-label="Slot löschen"
                    onClick={() => {
                      deleteSlot(slot.id);
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
        <div className="panel">
          <h2>Neue Terminbuchung</h2>
          {bookings.length === 0 ? <p>Noch keine Buchungen.</p> : null}
          {bookings.map((booking) => {
            const slot = slots.find((item) => item.id === booking.slotId);
            return (
              <article key={booking.id} className="notification-box">
                <strong>Name: {booking.customerName}</strong>
                <span>Email: {booking.customerEmail}</span>
                <span>Datum: {slot ? formatGermanDate(slot.date, slot.startTime) : "Slot gelöscht"}</span>
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
