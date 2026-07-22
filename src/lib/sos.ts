import { differenceInMinutes, format, parseISO } from "date-fns";
import type {
  CarePartner,
  ElderWiseStore,
  FamilyDoctor,
  LocalBuddy,
  LovedOne,
  SOSCascadeRole,
  SOSCascadeStep,
  SOSEvent,
  SOSTimelineEntry,
} from "@/types";

const ROLE_ORDER: SOSCascadeRole[] = [
  "loved_one",
  "care_partner",
  "local_buddy",
  "family_doctor",
];

export const CASCADE_ROLE_META: Record<
  SOSCascadeRole,
  { label: string; short: string; description: string }
> = {
  loved_one: {
    label: "Loved One",
    short: "LO",
    description: "SOS triggered from WhatsApp or the ElderWise demo",
  },
  care_partner: {
    label: "Care Partner",
    short: "CP",
    description: "Primary alert — review and acknowledge",
  },
  local_buddy: {
    label: "Local Buddy",
    short: "LB",
    description: "Nearby support escalated for in-person help",
  },
  family_doctor: {
    label: "Family Doctor",
    short: "MD",
    description: "Clinical escalation when the circle needs guidance",
  },
};

function uid(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function pushTimeline(
  timeline: SOSTimelineEntry[],
  entry: Omit<SOSTimelineEntry, "id">,
): SOSTimelineEntry[] {
  return [...timeline, { ...entry, id: uid("tl") }];
}

export function ensureSosShape(event: SOSEvent): SOSEvent {
  return {
    ...event,
    cascadeSteps: event.cascadeSteps ?? [],
    timeline: event.timeline ?? [],
    responders: event.responders ?? [],
    callsMade: event.callsMade ?? [],
    whatsappActions: event.whatsappActions ?? [],
  };
}

export function buildInitialCascade(input: {
  lovedOne: LovedOne;
  carePartner: CarePartner | null;
  buddy?: LocalBuddy;
  doctor?: FamilyDoctor;
  triggeredAt: string;
}): SOSCascadeStep[] {
  const { lovedOne, carePartner, buddy, doctor, triggeredAt } = input;
  return [
    {
      role: "loved_one",
      label: CASCADE_ROLE_META.loved_one.label,
      actorName: `${lovedOne.firstName} ${lovedOne.surname}`,
      contact: lovedOne.whatsappNumber,
      status: "completed",
      notifiedAt: triggeredAt,
      acknowledgedAt: triggeredAt,
      note: "SOS triggered",
    },
    {
      role: "care_partner",
      label: CASCADE_ROLE_META.care_partner.label,
      actorName: carePartner
        ? `${carePartner.firstName} ${carePartner.lastName}`
        : "Care Partner",
      contact: carePartner?.whatsappNumber,
      status: "pending",
      note: "Waiting to notify",
    },
    {
      role: "local_buddy",
      label: CASCADE_ROLE_META.local_buddy.label,
      actorName: buddy?.name ?? "No Local Buddy on file",
      contact: buddy?.whatsappNumber,
      status: buddy ? "pending" : "skipped",
      note: buddy ? "Queued after Care Partner" : "Skipped — no Local Buddy",
    },
    {
      role: "family_doctor",
      label: CASCADE_ROLE_META.family_doctor.label,
      actorName: doctor?.name ?? "No Family Doctor on file",
      contact: doctor?.whatsappNumber,
      status: doctor ? "pending" : "skipped",
      note: doctor ? "Queued after Local Buddy" : "Skipped — no Family Doctor",
    },
  ];
}

export function createTriggeredSos(input: {
  store: ElderWiseStore;
  lovedOneId: string;
  channel?: SOSEvent["triggerChannel"];
  locationPlaceholder?: string;
  autoCascade?: boolean;
}): { event: SOSEvent; notificationId: string } {
  const lovedOne = input.store.lovedOnes.find((lo) => lo.id === input.lovedOneId);
  if (!lovedOne) throw new Error("Loved One not found");

  const buddy = input.store.localBuddies.find((b) => b.lovedOneId === lovedOne.id);
  const doctor = input.store.doctors.find((d) => d.lovedOneId === lovedOne.id);
  const now = new Date().toISOString();
  const cascadeSteps = buildInitialCascade({
    lovedOne,
    carePartner: input.store.carePartner,
    buddy,
    doctor,
    triggeredAt: now,
  });

  let timeline: SOSTimelineEntry[] = [];
  timeline = pushTimeline(timeline, {
    at: now,
    title: `${lovedOne.firstName} triggered an SOS`,
    detail: `Channel · ${input.channel ?? "simulated"} · ${
      input.locationPlaceholder || lovedOne.address || "Location unavailable"
    }`,
    tone: "sos",
    role: "loved_one",
  });
  timeline = pushTimeline(timeline, {
    at: now,
    title: "Emergency cascade started",
    detail: "Loved One → Care Partner → Local Buddy → Family Doctor",
    tone: "info",
  });

  const event: SOSEvent = {
    id: uid("sos"),
    lovedOneId: lovedOne.id,
    status: "active",
    triggeredAt: now,
    triggerChannel: input.channel ?? "simulated",
    locationPlaceholder:
      input.locationPlaceholder || lovedOne.address || "Home · location approximate",
    carePartnerNotified: false,
    localBuddyNotified: false,
    doctorNotified: false,
    responders: [],
    callsMade: [],
    whatsappActions: [`SOS initiated by ${lovedOne.firstName}`],
    cascadeSteps,
    timeline,
    autoCascade: input.autoCascade ?? true,
  };

  return { event, notificationId: uid("n") };
}

/** Advance the next pending cascade role (demo auto-timer or manual escalate). */
export function advanceSosCascade(event: SOSEvent, at = new Date().toISOString()): SOSEvent {
  const e = ensureSosShape(event);
  if (e.status === "resolved" || e.status === "cancelled") return e;

  const next = e.cascadeSteps.find((s) => s.status === "pending");
  if (!next) {
    return { ...e, autoCascade: false };
  }

  const steps = e.cascadeSteps.map((s) => {
    if (s.role !== next.role) return s;
    return {
      ...s,
      status: "notified" as const,
      notifiedAt: at,
      note:
        s.role === "care_partner"
          ? "WhatsApp + push alert delivered"
          : s.role === "local_buddy"
            ? "Escalation alert sent — nearby support"
            : "Clinical alert shared with Family Doctor",
    };
  });

  const timeline = pushTimeline(e.timeline, {
    at,
    title: `${CASCADE_ROLE_META[next.role].label} notified`,
    detail: `${next.actorName}${next.contact ? ` · ${next.contact}` : ""}`,
    tone: next.role === "family_doctor" ? "warn" : "info",
    role: next.role,
  });

  const whatsappActions = [
    ...e.whatsappActions,
    `Alert sent to ${CASCADE_ROLE_META[next.role].label} (${next.actorName})`,
  ];

  return {
    ...e,
    cascadeSteps: steps,
    timeline,
    whatsappActions,
    carePartnerNotified:
      e.carePartnerNotified || next.role === "care_partner" || steps.some((s) => s.role === "care_partner" && s.status !== "pending" && s.status !== "skipped"),
    localBuddyNotified:
      e.localBuddyNotified || next.role === "local_buddy",
    doctorNotified: e.doctorNotified || next.role === "family_doctor",
    autoCascade: steps.some((s) => s.status === "pending"),
  };
}

export function acknowledgeSos(
  event: SOSEvent,
  byName: string,
  at = new Date().toISOString(),
): SOSEvent {
  let e = ensureSosShape(event);

  const cp = e.cascadeSteps.find((s) => s.role === "care_partner");
  if (cp && cp.status === "pending") {
    e = advanceSosCascade(e, at);
  }

  const steps = e.cascadeSteps.map((s) => {
    if (s.role !== "care_partner") return s;
    return {
      ...s,
      status: "acknowledged" as const,
      notifiedAt: s.notifiedAt ?? at,
      acknowledgedAt: at,
      note: `Acknowledged by ${byName}`,
    };
  });

  const timeline = pushTimeline(e.timeline, {
    at,
    title: "Care Partner acknowledged",
    detail: `${byName} confirmed they are responding`,
    tone: "ok",
    role: "care_partner",
  });

  return {
    ...e,
    status: "acknowledged",
    acknowledgedAt: at,
    acknowledgedBy: byName,
    responders: Array.from(new Set([...e.responders, byName])),
    callsMade: e.callsMade.includes("Called Loved One")
      ? e.callsMade
      : [...e.callsMade, "Called Loved One"],
    whatsappActions: [...e.whatsappActions, `Acknowledged by ${byName} via ElderWise`],
    cascadeSteps: steps,
    timeline,
    carePartnerNotified: true,
  };
}

export function markCascadeAcknowledged(
  event: SOSEvent,
  role: Exclude<SOSCascadeRole, "loved_one">,
  at = new Date().toISOString(),
): SOSEvent {
  const e = ensureSosShape(event);
  const step = e.cascadeSteps.find((s) => s.role === role);
  if (!step || step.status === "skipped") return e;

  const steps = e.cascadeSteps.map((s) => {
    if (s.role !== role) return s;
    return {
      ...s,
      status: "acknowledged" as const,
      notifiedAt: s.notifiedAt ?? at,
      acknowledgedAt: at,
      note: `${s.actorName} confirmed`,
    };
  });

  const timeline = pushTimeline(e.timeline, {
    at,
    title: `${CASCADE_ROLE_META[role].label} acknowledged`,
    detail: step.actorName,
    tone: "ok",
    role,
  });

  return {
    ...e,
    cascadeSteps: steps,
    timeline,
    responders: Array.from(new Set([...e.responders, step.actorName])),
    whatsappActions: [
      ...e.whatsappActions,
      `${CASCADE_ROLE_META[role].label} acknowledged`,
    ],
  };
}

export function resolveSos(
  event: SOSEvent,
  notes: string,
  at = new Date().toISOString(),
): SOSEvent {
  const e = ensureSosShape(event);
  const minutes = Math.max(1, differenceInMinutes(parseISO(at), parseISO(e.triggeredAt)));

  const steps = e.cascadeSteps.map((s) => {
    if (s.status === "skipped" || s.status === "pending") {
      return s.status === "pending"
        ? { ...s, status: "skipped" as const, note: "Cascade closed on resolution" }
        : s;
    }
    if (s.status === "notified" || s.status === "acknowledged") {
      return { ...s, status: "completed" as const, note: s.note ?? "Completed" };
    }
    return s;
  });

  const timeline = pushTimeline(e.timeline, {
    at,
    title: "SOS resolved",
    detail: notes.trim() || "Emergency closed by Care Partner",
    tone: "ok",
  });

  return {
    ...e,
    status: "resolved",
    resolvedAt: at,
    resolutionNotes: notes.trim() || "Resolved — situation stable.",
    averageResponseMinutes: e.acknowledgedAt
      ? Math.max(
          1,
          differenceInMinutes(parseISO(e.acknowledgedAt), parseISO(e.triggeredAt)),
        )
      : minutes,
    cascadeSteps: steps,
    timeline,
    autoCascade: false,
    whatsappActions: [...e.whatsappActions, "Resolution shared with Care Circle"],
  };
}

export function cancelSos(event: SOSEvent, at = new Date().toISOString()): SOSEvent {
  const e = ensureSosShape(event);
  const timeline = pushTimeline(e.timeline, {
    at,
    title: "SOS cancelled",
    detail: "Alert closed without further escalation",
    tone: "neutral",
  });
  return {
    ...e,
    status: "cancelled",
    resolvedAt: at,
    resolutionNotes: e.resolutionNotes || "Cancelled by Care Partner",
    cascadeSteps: e.cascadeSteps.map((s) =>
      s.status === "pending" ? { ...s, status: "skipped" as const, note: "Cancelled" } : s,
    ),
    timeline,
    autoCascade: false,
  };
}

export function hydrateLegacySos(
  event: SOSEvent,
  store: ElderWiseStore,
): SOSEvent {
  const e = ensureSosShape(event);
  if (e.cascadeSteps.length > 0 && e.timeline.length > 0) return e;

  const lovedOne = store.lovedOnes.find((lo) => lo.id === e.lovedOneId);
  if (!lovedOne) return e;

  const buddy = store.localBuddies.find((b) => b.lovedOneId === lovedOne.id);
  const doctor = store.doctors.find((d) => d.lovedOneId === lovedOne.id);
  const cascade =
    e.cascadeSteps.length > 0
      ? e.cascadeSteps
      : buildInitialCascade({
          lovedOne,
          carePartner: store.carePartner,
          buddy,
          doctor,
          triggeredAt: e.triggeredAt,
        }).map((s) => {
          if (s.role === "loved_one") return s;
          if (s.role === "care_partner") {
            if (e.carePartnerNotified) {
              return {
                ...s,
                status: (e.acknowledgedAt ? "acknowledged" : "notified") as SOSCascadeStep["status"],
                notifiedAt: e.triggeredAt,
                acknowledgedAt: e.acknowledgedAt,
                note: e.acknowledgedBy
                  ? `Acknowledged by ${e.acknowledgedBy}`
                  : "Care Partner notified",
              };
            }
            return s;
          }
          if (s.role === "local_buddy" && buddy) {
            if (e.localBuddyNotified) {
              return {
                ...s,
                status: (e.status === "resolved" ? "completed" : "notified") as SOSCascadeStep["status"],
                notifiedAt: e.triggeredAt,
              };
            }
            return s;
          }
          if (s.role === "family_doctor" && doctor) {
            if (e.doctorNotified) {
              return {
                ...s,
                status: (e.status === "resolved" ? "completed" : "notified") as SOSCascadeStep["status"],
                notifiedAt: e.triggeredAt,
              };
            }
            return s;
          }
          return s;
        });

  let timeline = e.timeline;
  if (timeline.length === 0) {
    timeline = pushTimeline([], {
      at: e.triggeredAt,
      title: `${lovedOne.firstName} triggered an SOS`,
      detail: e.locationPlaceholder,
      tone: "sos",
      role: "loved_one",
    });
    if (e.carePartnerNotified) {
      timeline = pushTimeline(timeline, {
        at: e.triggeredAt,
        title: "Care Partner notified",
        tone: "info",
        role: "care_partner",
      });
    }
    if (e.acknowledgedAt) {
      timeline = pushTimeline(timeline, {
        at: e.acknowledgedAt,
        title: "Acknowledged",
        detail: e.acknowledgedBy,
        tone: "ok",
        role: "care_partner",
      });
    }
    e.whatsappActions.forEach((action, i) => {
      timeline = pushTimeline(timeline, {
        at: e.acknowledgedAt ?? e.triggeredAt,
        title: action,
        tone: "neutral",
        detail: `Action ${i + 1}`,
      });
    });
    if (e.resolvedAt) {
      timeline = pushTimeline(timeline, {
        at: e.resolvedAt,
        title: e.status === "cancelled" ? "SOS cancelled" : "SOS resolved",
        detail: e.resolutionNotes,
        tone: e.status === "cancelled" ? "neutral" : "ok",
      });
    }
  }

  return { ...e, cascadeSteps: cascade, timeline };
}

export function applySosToStore(
  store: ElderWiseStore,
  event: SOSEvent,
  opts?: { notificationTitle?: string; notificationBody?: string },
): ElderWiseStore {
  const exists = store.sosEvents.some((s) => s.id === event.id);
  const sosEvents = exists
    ? store.sosEvents.map((s) => (s.id === event.id ? event : s))
    : [event, ...store.sosEvents];

  const lovedOnes = store.lovedOnes.map((lo) => {
    if (lo.id !== event.lovedOneId) return lo;
    const wellbeingStatus =
      event.status === "active" || event.status === "acknowledged"
        ? ("urgent" as const)
        : lo.wellbeingStatus === "urgent"
          ? ("attention" as const)
          : lo.wellbeingStatus;
    return { ...lo, wellbeingStatus, updatedAt: new Date().toISOString() };
  });

  let notifications = store.notifications;
  if (!exists) {
    notifications = [
      {
        id: uid("n"),
        lovedOneId: event.lovedOneId,
        category: "sos" as const,
        title: opts?.notificationTitle ?? "SOS alert",
        body:
          opts?.notificationBody ??
          "An emergency cascade is running. Open SOS to follow the timeline.",
        createdAt: event.triggeredAt,
        read: false,
        href: "/sos",
      },
      ...store.notifications,
    ];
  }

  return {
    ...store,
    sosEvents,
    lovedOnes,
    notifications,
    selectedLovedOneId: event.lovedOneId,
  };
}

export function formatSosClock(iso: string) {
  try {
    return format(parseISO(iso), "h:mm:ss a");
  } catch {
    return iso;
  }
}

export function formatSosDateTime(iso: string) {
  try {
    return format(parseISO(iso), "d MMM · h:mm a");
  } catch {
    return iso;
  }
}

export function cascadeProgress(steps: SOSCascadeStep[]) {
  const actionable = steps.filter((s) => s.status !== "skipped");
  if (actionable.length === 0) return 0;
  const done = actionable.filter(
    (s) =>
      s.status === "notified" ||
      s.status === "acknowledged" ||
      s.status === "completed",
  ).length;
  return Math.round((done / actionable.length) * 100);
}

export { ROLE_ORDER };
