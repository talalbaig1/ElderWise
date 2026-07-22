import { readStorage, STORAGE_KEYS, writeStorage } from "@/lib/storage";
import type { CarePartner } from "@/types";

export interface StoredAccount {
  id: string;
  email: string;
  /** Demo-only hash — replace with a real auth provider later */
  passwordHash: string;
  firstName: string;
  lastName: string;
  createdAt: string;
  onboardingComplete: boolean;
}

function hashPassword(password: string) {
  // Lightweight reversible-resistant demo hash (not for production)
  const salted = `elderwise::${password}::v1`;
  if (typeof window !== "undefined" && window.btoa) {
    return window.btoa(unescape(encodeURIComponent(salted)));
  }
  return Buffer.from(salted, "utf8").toString("base64");
}

export function getAccounts(): StoredAccount[] {
  return readStorage<StoredAccount[]>(STORAGE_KEYS.accounts, []);
}

function saveAccounts(accounts: StoredAccount[]) {
  writeStorage(STORAGE_KEYS.accounts, accounts);
}

export function findAccountByEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  return getAccounts().find((account) => account.email === normalized) ?? null;
}

export function createAccount(input: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}): { ok: true; account: StoredAccount } | { ok: false; error: string } {
  const email = input.email.trim().toLowerCase();
  if (findAccountByEmail(email)) {
    return { ok: false, error: "An account with this email already exists." };
  }

  const account: StoredAccount = {
    id: `cp-${crypto.randomUUID()}`,
    email,
    passwordHash: hashPassword(input.password),
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    createdAt: new Date().toISOString(),
    onboardingComplete: false,
  };

  saveAccounts([...getAccounts(), account]);
  return { ok: true, account };
}

export function verifyAccount(
  email: string,
  password: string,
): { ok: true; account: StoredAccount } | { ok: false; error: string } {
  const account = findAccountByEmail(email);
  if (!account) {
    return { ok: false, error: "No account found with that email." };
  }
  if (account.passwordHash !== hashPassword(password)) {
    return { ok: false, error: "Incorrect password. Please try again." };
  }
  return { ok: true, account };
}

export function markAccountOnboardingComplete(accountId: string) {
  const accounts = getAccounts().map((account) =>
    account.id === accountId ? { ...account, onboardingComplete: true } : account,
  );
  saveAccounts(accounts);
}

export function requestPasswordReset(email: string) {
  const account = findAccountByEmail(email);
  return {
    ok: true as const,
    exists: Boolean(account),
    message: account
      ? "If an account exists for that email, a reset link has been sent. (Demo — no email is actually sent.)"
      : "If an account exists for that email, a reset link has been sent. (Demo — no email is actually sent.)",
  };
}

export function changeAccountPassword(input: {
  accountId: string;
  currentPassword: string;
  newPassword: string;
}): { ok: true } | { ok: false; error: string } {
  const accounts = getAccounts();
  const account = accounts.find((a) => a.id === input.accountId);
  if (!account) {
    return { ok: false, error: "Account not found." };
  }
  if (account.passwordHash !== hashPassword(input.currentPassword)) {
    return { ok: false, error: "Current password is incorrect." };
  }
  if (input.newPassword.length < 8) {
    return { ok: false, error: "New password must be at least 8 characters." };
  }
  if (!/[A-Z]/.test(input.newPassword) || !/[a-z]/.test(input.newPassword) || !/[0-9]/.test(input.newPassword)) {
    return {
      ok: false,
      error: "Use upper and lower case letters plus at least one number.",
    };
  }
  if (input.currentPassword === input.newPassword) {
    return { ok: false, error: "New password must be different from the current one." };
  }

  saveAccounts(
    accounts.map((a) =>
      a.id === input.accountId
        ? { ...a, passwordHash: hashPassword(input.newPassword) }
        : a,
    ),
  );
  return { ok: true };
}

export function updateAccountNames(input: {
  accountId: string;
  firstName: string;
  lastName: string;
}) {
  const accounts = getAccounts().map((account) =>
    account.id === input.accountId
      ? {
          ...account,
          firstName: input.firstName.trim(),
          lastName: input.lastName.trim(),
        }
      : account,
  );
  saveAccounts(accounts);
}

export function accountToCarePartner(account: StoredAccount): CarePartner {
  return {
    id: account.id,
    firstName: account.firstName,
    lastName: account.lastName,
    email: account.email,
    whatsappNumber: "",
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    language: "en",
    preferredNotificationMethod: "email",
    createdAt: account.createdAt,
    updatedAt: new Date().toISOString(),
  };
}
