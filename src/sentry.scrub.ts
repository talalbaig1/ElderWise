import type { ErrorEvent } from "@sentry/nextjs";

// A doctor share token is a live credential that exists only in the URL
// (Architecture §7.3, Rules SEC2). It must never leave this process.
const SHARE_PATH = /\/share\/[^/?#\s]+/g;
// E.164, and Meta's plus-stripped form (Architecture §8 WF-2a).
const PHONE = /\+?\d{9,15}/g;

function redact(value: string): string {
  return value.replace(SHARE_PATH, "/share/[redacted]").replace(PHONE, "[redacted-number]");
}

export function scrubEvent(event: ErrorEvent): ErrorEvent | null {
  if (event.request) {
    if (event.request.url) event.request.url = redact(event.request.url);
    delete event.request.headers;
    delete event.request.cookies;
    delete event.request.data;
    delete event.request.query_string;
  }

  delete event.user;
  delete event.server_name;

  if (event.transaction) event.transaction = redact(event.transaction);
  if (event.message) event.message = redact(event.message);

  for (const exception of event.exception?.values ?? []) {
    if (exception.value) exception.value = redact(exception.value);
  }

  for (const crumb of event.breadcrumbs ?? []) {
    if (crumb.message) crumb.message = redact(crumb.message);
    if (typeof crumb.data?.url === "string") crumb.data.url = redact(crumb.data.url);
  }

  return event;
}
