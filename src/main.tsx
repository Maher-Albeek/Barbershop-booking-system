import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import App from "./App";
import { registerServiceWorker } from "./pwa/register";
import "./styles.css";

const HomePage = lazy(() => import("./pages/HomePage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));
const LegalPage = lazy(() => import("./pages/LegalPage"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

function lazyRoute(element: React.ReactNode) {
  return <Suspense fallback={<div className="route-loading" aria-live="polite" />}>{element}</Suspense>;
}

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: lazyRoute(<HomePage />) },
      { path: "admin", element: lazyRoute(<AdminPage />) },
      { path: "impressum", element: lazyRoute(<LegalPage type="impressum" />) },
      { path: "datenschutz", element: lazyRoute(<LegalPage type="datenschutz" />) },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>,
);

registerServiceWorker();
