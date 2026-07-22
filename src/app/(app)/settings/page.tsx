"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  Accessibility,
  Bell,
  Eye,
  Globe2,
  KeyRound,
  LogOut,
  MessageCircle,
  Moon,
  RotateCcw,
  Sun,
  UserRound,
  Watch,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { changeAccountPassword, updateAccountNames } from "@/lib/auth";
import {
  LANGUAGE_OPTIONS,
  TIMEZONE_OPTIONS,
  detectBrowserTimeZone,
} from "@/lib/settings";
import { useAuth, useElderWiseStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { CarePartner, NotificationMethod, UserSettings } from "@/types";

type SettingsSection =
  | "profile"
  | "notifications"
  | "theme"
  | "language"
  | "password"
  | "whatsapp"
  | "timezone"
  | "accessibility"
  | "account";

const SECTIONS: {
  id: SettingsSection;
  label: string;
  icon: typeof UserRound;
  description: string;
}[] = [
  { id: "profile", label: "Profile", icon: UserRound, description: "Care Partner details" },
  { id: "notifications", label: "Notifications", icon: Bell, description: "Email, push, alerts" },
  { id: "theme", label: "Theme", icon: Sun, description: "Light, dark, system" },
  { id: "language", label: "Language", icon: Globe2, description: "App language" },
  { id: "password", label: "Password", icon: KeyRound, description: "Change password" },
  { id: "whatsapp", label: "WhatsApp", icon: MessageCircle, description: "Check-in preferences" },
  { id: "timezone", label: "Timezone", icon: Watch, description: "Local schedule time" },
  { id: "accessibility", label: "Accessibility", icon: Accessibility, description: "Reading comfort" },
  { id: "account", label: "Account", icon: LogOut, description: "Reset & sign out" },
];

export default function SettingsPage() {
  const router = useRouter();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { store, setStore, updateSettings, resetDemoData, hydrated } = useElderWiseStore();
  const { signOut, carePartner } = useAuth();

  const [section, setSection] = useState<SettingsSection>("profile");
  const [resetOpen, setResetOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);

  const [profile, setProfile] = useState({
    firstName: "",
    lastName: "",
    email: "",
    whatsappNumber: "",
    directContactNumber: "",
    address: "",
    relationshipToLovedOne: "",
    preferredNotificationMethod: "whatsapp" as NotificationMethod,
  });

  const [passwordForm, setPasswordForm] = useState({
    current: "",
    next: "",
    confirm: "",
  });
  const [showPasswords, setShowPasswords] = useState(false);

  useEffect(() => {
    if (!carePartner) return;
    setProfile({
      firstName: carePartner.firstName,
      lastName: carePartner.lastName,
      email: carePartner.email,
      whatsappNumber: carePartner.whatsappNumber || "",
      directContactNumber: carePartner.directContactNumber || "",
      address: carePartner.address || "",
      relationshipToLovedOne: carePartner.relationshipToLovedOne || "",
      preferredNotificationMethod: carePartner.preferredNotificationMethod || "whatsapp",
    });
  }, [carePartner]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash.replace("#", "") as SettingsSection;
    if (SECTIONS.some((s) => s.id === hash)) setSection(hash);
  }, []);

  const selectSection = (id: SettingsSection) => {
    setSection(id);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `#${id}`);
    }
  };

  const settings = store.settings;

  const patchSettings = (partial: Partial<UserSettings>) => {
    updateSettings(partial);
    if (partial.theme) setTheme(partial.theme);
  };

  const saveProfile = () => {
    if (!profile.firstName.trim() || !profile.lastName.trim()) {
      toast.error("First and last name are required");
      return;
    }
    if (!carePartner) {
      toast.error("No Care Partner profile loaded");
      return;
    }

    const updated: CarePartner = {
      ...carePartner,
      firstName: profile.firstName.trim(),
      lastName: profile.lastName.trim(),
      whatsappNumber: profile.whatsappNumber.trim(),
      directContactNumber: profile.directContactNumber.trim() || undefined,
      address: profile.address.trim() || undefined,
      relationshipToLovedOne: profile.relationshipToLovedOne.trim() || undefined,
      preferredNotificationMethod: profile.preferredNotificationMethod,
      language: settings.language,
      timeZone: settings.timeZone,
      updatedAt: new Date().toISOString(),
    };

    setStore((prev) => ({ ...prev, carePartner: updated }));
    if (store.session.carePartnerId) {
      updateAccountNames({
        accountId: store.session.carePartnerId,
        firstName: updated.firstName,
        lastName: updated.lastName,
      });
    }
    toast.success("Profile saved");
  };

  const savePassword = () => {
    if (!store.session.carePartnerId) {
      toast.error("Sign in again to change your password");
      return;
    }
    if (passwordForm.next !== passwordForm.confirm) {
      toast.error("New passwords do not match");
      return;
    }
    const result = changeAccountPassword({
      accountId: store.session.carePartnerId,
      currentPassword: passwordForm.current,
      newPassword: passwordForm.next,
    });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setPasswordForm({ current: "", next: "", confirm: "" });
    toast.success("Password updated");
  };

  const onResetDemo = () => {
    resetDemoData();
    setResetOpen(false);
    toast.success("Demo data reset — your session and settings were kept");
  };

  const onLogout = () => {
    signOut();
    setLogoutOpen(false);
    toast.success("Signed out");
    router.replace("/sign-in");
  };

  const activeMeta = useMemo(
    () => SECTIONS.find((s) => s.id === section) ?? SECTIONS[0],
    [section],
  );

  if (!hydrated) {
    return <div className="h-40 animate-pulse rounded-2xl bg-secondary" />;
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-primary">Settings</p>
        <h1 className="font-display text-3xl tracking-tight md:text-4xl">Preferences</h1>
        <p className="mt-1 max-w-2xl text-muted-foreground">
          Profile, notifications, theme, language, WhatsApp, timezone, and accessibility —
          saved locally on this device.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <Card className="h-fit lg:sticky lg:top-24">
          <CardContent className="space-y-1 p-3">
            {SECTIONS.map((item) => {
              const Icon = item.icon;
              const active = section === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectSection(item.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="font-medium">{item.label}</span>
                </button>
              );
            })}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <div>
            <h2 className="font-display text-2xl">{activeMeta.label}</h2>
            <p className="text-sm text-muted-foreground">{activeMeta.description}</p>
          </div>

          {section === "profile" ? (
            <Card>
              <CardHeader>
                <CardTitle>Care Partner profile</CardTitle>
                <CardDescription>
                  Details used across the dashboard, SOS cascade, and WhatsApp previews.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <Field label="First name">
                  <Input
                    value={profile.firstName}
                    onChange={(e) => setProfile((p) => ({ ...p, firstName: e.target.value }))}
                  />
                </Field>
                <Field label="Last name">
                  <Input
                    value={profile.lastName}
                    onChange={(e) => setProfile((p) => ({ ...p, lastName: e.target.value }))}
                  />
                </Field>
                <Field label="Email">
                  <Input value={profile.email} disabled />
                </Field>
                <Field label="Relationship to Loved One">
                  <Input
                    value={profile.relationshipToLovedOne}
                    onChange={(e) =>
                      setProfile((p) => ({ ...p, relationshipToLovedOne: e.target.value }))
                    }
                    placeholder="e.g. Daughter"
                  />
                </Field>
                <Field label="WhatsApp number">
                  <Input
                    value={profile.whatsappNumber}
                    onChange={(e) => setProfile((p) => ({ ...p, whatsappNumber: e.target.value }))}
                    placeholder="+91 …"
                  />
                </Field>
                <Field label="Direct contact">
                  <Input
                    value={profile.directContactNumber}
                    onChange={(e) =>
                      setProfile((p) => ({ ...p, directContactNumber: e.target.value }))
                    }
                  />
                </Field>
                <Field label="Address" className="sm:col-span-2">
                  <Input
                    value={profile.address}
                    onChange={(e) => setProfile((p) => ({ ...p, address: e.target.value }))}
                  />
                </Field>
                <Field label="Preferred notification method" className="sm:col-span-2">
                  <Select
                    value={profile.preferredNotificationMethod}
                    onValueChange={(v) =>
                      setProfile((p) => ({
                        ...p,
                        preferredNotificationMethod: v as NotificationMethod,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="sms">SMS</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="push">Push</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <div className="sm:col-span-2">
                  <Button onClick={saveProfile}>Save profile</Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {section === "notifications" ? (
            <Card>
              <CardHeader>
                <CardTitle>Notification channels</CardTitle>
                <CardDescription>
                  Choose how ElderWise reaches you. Preferences persist in localStorage.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ToggleRow
                  id="email-n"
                  label="Email notifications"
                  description="Account and weekly report emails"
                  checked={settings.emailNotifications}
                  onChange={(v) => patchSettings({ emailNotifications: v })}
                />
                <ToggleRow
                  id="push-n"
                  label="Push notifications"
                  description="In-app and browser push (demo)"
                  checked={settings.pushNotifications}
                  onChange={(v) => patchSettings({ pushNotifications: v })}
                />
                <ToggleRow
                  id="wa-n"
                  label="WhatsApp notifications"
                  description="Master switch for WhatsApp check-ins and alerts"
                  checked={settings.whatsappNotifications}
                  onChange={(v) => patchSettings({ whatsappNotifications: v })}
                />
                <ToggleRow
                  id="missed-n"
                  label="Missed routine alerts"
                  description="Notify when medication, meals, or health check-ins are missed"
                  checked={settings.missedRoutineAlerts}
                  onChange={(v) => patchSettings({ missedRoutineAlerts: v })}
                />
                <ToggleRow
                  id="report-n"
                  label="Report ready alerts"
                  description="Tell me when wellbeing reports are ready to preview"
                  checked={settings.reportReadyAlerts}
                  onChange={(v) => patchSettings({ reportReadyAlerts: v })}
                />
              </CardContent>
            </Card>
          ) : null}

          {section === "theme" ? (
            <Card>
              <CardHeader>
                <CardTitle>Appearance</CardTitle>
                <CardDescription>
                  Warm light is the default. Dark mode is available anytime.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      { id: "light", label: "Light", icon: Sun },
                      { id: "dark", label: "Dark", icon: Moon },
                      { id: "system", label: "System", icon: Eye },
                    ] as const
                  ).map((opt) => {
                    const Icon = opt.icon;
                    const active = (theme ?? settings.theme) === opt.id;
                    return (
                      <Button
                        key={opt.id}
                        variant={active ? "default" : "outline"}
                        className="gap-2"
                        onClick={() => patchSettings({ theme: opt.id })}
                      >
                        <Icon className="h-4 w-4" />
                        {opt.label}
                      </Button>
                    );
                  })}
                </div>
                <p className="text-sm text-muted-foreground">
                  Currently showing{" "}
                  <span className="font-medium text-foreground">
                    {resolvedTheme ?? settings.theme}
                  </span>{" "}
                  mode on this device.
                </p>
              </CardContent>
            </Card>
          ) : null}

          {section === "language" ? (
            <Card>
              <CardHeader>
                <CardTitle>Language</CardTitle>
                <CardDescription>
                  App UI language preference (demo labels stay English; preference is stored).
                </CardDescription>
              </CardHeader>
              <CardContent className="max-w-md space-y-3">
                <Label>Preferred language</Label>
                <Select
                  value={settings.language}
                  onValueChange={(v) => {
                    patchSettings({ language: v });
                    if (carePartner) {
                      setStore((prev) =>
                        prev.carePartner
                          ? {
                              ...prev,
                              carePartner: {
                                ...prev.carePartner,
                                language: v,
                                updatedAt: new Date().toISOString(),
                              },
                            }
                          : prev,
                      );
                    }
                    toast.success("Language preference saved");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGE_OPTIONS.map((lang) => (
                      <SelectItem key={lang.value} value={lang.value}>
                        {lang.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          ) : null}

          {section === "password" ? (
            <Card>
              <CardHeader>
                <CardTitle>Password</CardTitle>
                <CardDescription>
                  Update the password for {store.session.email || "your account"} on this device.
                </CardDescription>
              </CardHeader>
              <CardContent className="max-w-md space-y-4">
                <Field label="Current password">
                  <Input
                    type={showPasswords ? "text" : "password"}
                    value={passwordForm.current}
                    onChange={(e) =>
                      setPasswordForm((p) => ({ ...p, current: e.target.value }))
                    }
                    autoComplete="current-password"
                  />
                </Field>
                <Field label="New password">
                  <Input
                    type={showPasswords ? "text" : "password"}
                    value={passwordForm.next}
                    onChange={(e) => setPasswordForm((p) => ({ ...p, next: e.target.value }))}
                    autoComplete="new-password"
                  />
                </Field>
                <Field label="Confirm new password">
                  <Input
                    type={showPasswords ? "text" : "password"}
                    value={passwordForm.confirm}
                    onChange={(e) =>
                      setPasswordForm((p) => ({ ...p, confirm: e.target.value }))
                    }
                    autoComplete="new-password"
                  />
                </Field>
                <ToggleRow
                  id="show-pw"
                  label="Show passwords"
                  description="Reveal characters while editing"
                  checked={showPasswords}
                  onChange={setShowPasswords}
                />
                <p className="text-xs text-muted-foreground">
                  Use at least 8 characters with upper case, lower case, and a number.
                </p>
                <Button onClick={savePassword}>Update password</Button>
              </CardContent>
            </Card>
          ) : null}

          {section === "whatsapp" ? (
            <Card>
              <CardHeader>
                <CardTitle>WhatsApp preferences</CardTitle>
                <CardDescription>
                  Quiet hours, digests, and SOS delivery for Care Circle messaging.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ToggleRow
                  id="wa-master"
                  label="Enable WhatsApp messages"
                  description="Send check-ins and Care Circle alerts via WhatsApp"
                  checked={settings.whatsappNotifications}
                  onChange={(v) => patchSettings({ whatsappNotifications: v })}
                />
                <ToggleRow
                  id="wa-quiet"
                  label="Quiet hours"
                  description="Pause non-urgent WhatsApp messages overnight"
                  checked={settings.whatsappQuietHoursEnabled}
                  onChange={(v) => patchSettings({ whatsappQuietHoursEnabled: v })}
                />
                {settings.whatsappQuietHoursEnabled ? (
                  <div className="grid gap-4 rounded-xl border bg-secondary/40 p-4 sm:grid-cols-2">
                    <Field label="Quiet hours start">
                      <Input
                        type="time"
                        value={settings.whatsappQuietHoursStart}
                        onChange={(e) =>
                          patchSettings({ whatsappQuietHoursStart: e.target.value })
                        }
                      />
                    </Field>
                    <Field label="Quiet hours end">
                      <Input
                        type="time"
                        value={settings.whatsappQuietHoursEnd}
                        onChange={(e) =>
                          patchSettings({ whatsappQuietHoursEnd: e.target.value })
                        }
                      />
                    </Field>
                  </div>
                ) : null}
                <ToggleRow
                  id="wa-digest"
                  label="Daily digest"
                  description="One evening summary of routines and journals"
                  checked={settings.whatsappDailyDigest}
                  onChange={(v) => patchSettings({ whatsappDailyDigest: v })}
                />
                <ToggleRow
                  id="wa-sos"
                  label="SOS always delivers"
                  description="Emergency alerts bypass quiet hours"
                  checked={settings.whatsappSosAlways}
                  onChange={(v) => patchSettings({ whatsappSosAlways: v })}
                />
                <div className="max-w-md space-y-2">
                  <Label>WhatsApp message language</Label>
                  <Select
                    value={settings.whatsappLanguage}
                    onValueChange={(v) => patchSettings({ whatsappLanguage: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LANGUAGE_OPTIONS.map((lang) => (
                        <SelectItem key={lang.value} value={lang.value}>
                          {lang.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {section === "timezone" ? (
            <Card>
              <CardHeader>
                <CardTitle>Timezone</CardTitle>
                <CardDescription>
                  Used for routine schedules, reports, and SOS timestamps.
                </CardDescription>
              </CardHeader>
              <CardContent className="max-w-md space-y-4">
                <div className="space-y-2">
                  <Label>Care Partner timezone</Label>
                  <Select
                    value={settings.timeZone}
                    onValueChange={(v) => {
                      patchSettings({ timeZone: v });
                      if (carePartner) {
                        setStore((prev) =>
                          prev.carePartner
                            ? {
                                ...prev,
                                carePartner: {
                                  ...prev.carePartner,
                                  timeZone: v,
                                  updatedAt: new Date().toISOString(),
                                },
                              }
                            : prev,
                        );
                      }
                      toast.success("Timezone saved");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEZONE_OPTIONS.map((tz) => (
                        <SelectItem key={tz.value} value={tz.value}>
                          {tz.label}
                        </SelectItem>
                      ))}
                      {!TIMEZONE_OPTIONS.some((t) => t.value === settings.timeZone) ? (
                        <SelectItem value={settings.timeZone}>{settings.timeZone}</SelectItem>
                      ) : null}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    const tz = detectBrowserTimeZone();
                    patchSettings({ timeZone: tz });
                    toast.success(`Set to browser timezone · ${tz}`);
                  }}
                >
                  Use browser timezone
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {section === "accessibility" ? (
            <Card>
              <CardHeader>
                <CardTitle>Accessibility</CardTitle>
                <CardDescription>
                  Comfort options apply immediately and persist with your settings.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ToggleRow
                  id="larger-text"
                  label="Larger text"
                  description="Increase base reading size across the app"
                  checked={settings.largerText}
                  onChange={(v) => patchSettings({ largerText: v })}
                />
                <ToggleRow
                  id="contrast"
                  label="Increased contrast"
                  description="Stronger borders and text contrast"
                  checked={settings.increasedContrast}
                  onChange={(v) => patchSettings({ increasedContrast: v })}
                />
                <ToggleRow
                  id="motion"
                  label="Reduced motion"
                  description="Limit animations and decorative motion"
                  checked={settings.reducedMotion}
                  onChange={(v) => patchSettings({ reducedMotion: v })}
                />
              </CardContent>
            </Card>
          ) : null}

          {section === "account" ? (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Reset demo data</CardTitle>
                  <CardDescription>
                    Restore seed Loved Ones, routines, SOS, journals, and reports. Your signed-in
                    session and settings preferences are kept.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="warning" className="gap-2" onClick={() => setResetOpen(true)}>
                    <RotateCcw className="h-4 w-4" />
                    Reset demo data
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Sign out</CardTitle>
                  <CardDescription>
                    End your Care Partner session on this device. Local data remains until reset.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    variant="destructive"
                    className="gap-2"
                    onClick={() => setLogoutOpen(true)}
                  >
                    <LogOut className="h-4 w-4" />
                    Log out
                  </Button>
                </CardContent>
              </Card>
            </div>
          ) : null}
        </div>
      </div>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset demo data?</DialogTitle>
            <DialogDescription>
              This replaces Loved Ones, routines, check-ins, SOS, Voice Journal, and reports with
              the seeded demo. Settings and your login stay intact.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetOpen(false)}>
              Cancel
            </Button>
            <Button variant="warning" onClick={onResetDemo}>
              Reset data
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={logoutOpen} onOpenChange={setLogoutOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log out?</DialogTitle>
            <DialogDescription>
              You will need to sign in again to open the Care Partner dashboard.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLogoutOpen(false)}>
              Stay signed in
            </Button>
            <Button variant="destructive" onClick={onLogout}>
              Log out
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function ToggleRow({
  id,
  label,
  description,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border px-4 py-3">
      <div className="space-y-0.5">
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
        </Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
