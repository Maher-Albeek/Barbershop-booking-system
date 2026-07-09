import { CookieScriptDefinition } from "./cookieTypes";

declare global {
  interface Window {
    dataLayer?: unknown[];
    fbq?: (...args: unknown[]) => void;
    _fbq?: unknown;
  }
}

type ScriptAttributes = Record<string, string>;

const appendExternalScript = (id: string, src: string, attributes: ScriptAttributes = {}) => {
  if (document.getElementById(id)) return;

  const script = document.createElement("script");
  script.id = id;
  script.async = true;
  script.src = src;

  Object.entries(attributes).forEach(([key, value]) => {
    script.setAttribute(key, value);
  });

  document.head.appendChild(script);
};

const appendInlineScript = (id: string, source: string, attributes: ScriptAttributes = {}) => {
  if (document.getElementById(id)) return;

  const script = document.createElement("script");
  script.id = id;
  script.text = source;

  Object.entries(attributes).forEach(([key, value]) => {
    script.setAttribute(key, value);
  });

  document.head.appendChild(script);
};

const removeScript = (id: string) => {
  document.getElementById(id)?.remove();
};

export const createGoogleAnalyticsLoader = (measurementId: string): CookieScriptDefinition => ({
  id: "google-analytics",
  category: "statistics",
  load: () => {
    appendExternalScript(
      "google-analytics-src",
      `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`,
      { "data-consent-category": "statistics" },
    );
    appendInlineScript(
      "google-analytics-config",
      `
        window.dataLayer = window.dataLayer || [];
        function gtag(){window.dataLayer.push(arguments);}
        gtag("js", new Date());
        gtag("config", "${measurementId}", { anonymize_ip: true });
      `,
      { "data-consent-category": "statistics" },
    );
  },
  unload: () => {
    removeScript("google-analytics-src");
    removeScript("google-analytics-config");
  },
});

export const createMetaPixelLoader = (pixelId: string): CookieScriptDefinition => ({
  id: "meta-pixel",
  category: "marketing",
  load: () => {
    appendInlineScript(
      "meta-pixel-config",
      `
        !function(f,b,e,v,n,t,s)
        {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
        n.callMethod.apply(n,arguments):n.queue.push(arguments)};
        if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version="2.0";
        n.queue=[];t=b.createElement(e);t.async=!0;
        t.src=v;s=b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t,s)}(window, document,
        "script", "https://connect.facebook.net/en_US/fbevents.js");
        fbq("init", "${pixelId}");
        fbq("track", "PageView");
      `,
      { "data-consent-category": "marketing" },
    );
  },
  unload: () => {
    removeScript("meta-pixel-config");
  },
});
