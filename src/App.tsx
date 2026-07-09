import { Outlet } from "react-router-dom";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import { CookieConsentProvider } from "./CookieContext";
import { CookieConsent } from "./components/CookieConsent";

export default function App() {
  return (
    <CookieConsentProvider>
      <Header />
      <main>
        <Outlet />
      </main>
      <Footer />
      <CookieConsent />
    </CookieConsentProvider>
  );
}
