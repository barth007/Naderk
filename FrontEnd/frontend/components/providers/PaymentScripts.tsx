"use client";

import Script from "next/script";

/**
 * Loads the payment gateway SDKs on the routes that actually take payments.
 *
 * These used to sit in the root layout with strategy="beforeInteractive",
 * which put two third-party DNS + TLS handshakes ahead of the app's own
 * bundle on *every* page — including the marketing site, which never takes a
 * payment. That delayed hydration site-wide, and an unhydrated page ignores
 * clicks.
 *
 * "afterInteractive" loads them as soon as the page is interactive, which is
 * still far earlier than a user can fill in a checkout form and press pay.
 * Next dedupes by src, so mounting this on several routes is safe.
 */
export default function PaymentScripts() {
  return (
    <>
      <Script src="https://js.paystack.co/v1/inline.js" strategy="afterInteractive" />
      <Script src="https://sdk.monnify.com/plugin/monnify.js" strategy="afterInteractive" />
    </>
  );
}
