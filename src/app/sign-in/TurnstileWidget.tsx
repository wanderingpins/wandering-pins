"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
    }
  ) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

// Cloudflare Turnstile challenge for a sign-in form. Drop it inside the
// <form>: the hidden `captchaToken` input rides along with the form
// submission, and the server action forwards it to Supabase (which verifies
// it when CAPTCHA protection is enabled in the Supabase dashboard).
//
// Tokens are single-use, so pass something that changes after every
// submission (the useActionState result) as `resetKey` to get a fresh one.
//
// Renders nothing when NEXT_PUBLIC_TURNSTILE_SITE_KEY is unset, so local dev
// works without a Cloudflare account as long as CAPTCHA is also off in the
// Supabase project being used.
export function TurnstileWidget({ resetKey }: { resetKey?: unknown }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [token, setToken] = useState("");

  const renderWidget = useCallback(() => {
    if (!SITE_KEY || !containerRef.current || !window.turnstile || widgetIdRef.current) return;
    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: SITE_KEY,
      callback: setToken,
      "expired-callback": () => setToken(""),
      "error-callback": () => setToken(""),
    });
  }, []);

  useEffect(() => {
    // The script may already be on the page from a sibling widget, in which
    // case <Script>'s onReady has fired and won't fire again for this mount.
    renderWidget();
    return () => {
      if (widgetIdRef.current && window.turnstile) window.turnstile.remove(widgetIdRef.current);
      widgetIdRef.current = null;
    };
  }, [renderWidget]);

  useEffect(() => {
    if (widgetIdRef.current && window.turnstile) {
      setToken("");
      window.turnstile.reset(widgetIdRef.current);
    }
  }, [resetKey]);

  if (!SITE_KEY) return null;

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={renderWidget}
      />
      <div ref={containerRef} />
      <input type="hidden" name="captchaToken" value={token} />
    </>
  );
}
