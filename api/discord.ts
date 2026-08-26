import { env } from "./lib/env";

type NewDepositNotification = {
  depositId: number;
  publicUserId?: number | null;
  amount: number;
  cryptoType: string;
  email: string;
};

type NewWithdrawalNotification = {
  withdrawalId: number;
  publicUserId?: number | null;
  amount: number;
  fee: number;
  wallet: string;
  email: string;
};

type NewUserNotification = {
  publicUserId?: number | null;
  name: string;
  email: string;
  referralCode?: string | null;
};

type NewTicketNotification = {
  ticketId: number;
  publicUserId?: number | null;
  email?: string | null;
  subject: string;
};

type DiscordField = {
  name: string;
  value: string;
  inline?: boolean;
};

function maskEmail(email: string): string {
  const [localPart, domain] = email.split("@");
  if (!domain) return "Gizli";
  const visible = localPart.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(3, localPart.length - visible.length))}@${domain}`;
}

function maskWallet(wallet: string): string {
  if (wallet.length <= 10) return "***";
  return `${wallet.slice(0, 4)}...${wallet.slice(-6)}`;
}

function safeText(value: string, maxLength = 1024): string {
  const cleaned = value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .trim();
  return (cleaned || "-").slice(0, maxLength);
}

async function sendAdminNotification(title: string, color: number, fields: DiscordField[]): Promise<boolean> {
  if (!env.discordWebhookUrl) return false;

  const response = await fetch(env.discordWebhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(3_000),
    body: JSON.stringify({
      username: "Corevest Admin Bildirimleri",
      allowed_mentions: { parse: [] },
      embeds: [
        {
          title,
          color,
          fields: fields.map((field) => ({
            ...field,
            name: safeText(field.name, 256),
            value: safeText(field.value),
          })),
          timestamp: new Date().toISOString(),
          footer: { text: "Corevest Admin" },
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Discord webhook returned ${response.status}`);
  }

  return true;
}

export async function queueDiscordNotification(label: string, task: () => Promise<boolean>): Promise<void> {
  try {
    const delivered = await task();
    console.info(`[discord] ${label} notification ${delivered ? "delivered" : "skipped: webhook not configured"}`);
  } catch (error) {
    console.error(
      `[discord] ${label} notification failed:`,
      error instanceof Error ? error.message : "Unknown error",
    );
  }
}

export async function notifyNewDeposit(input: NewDepositNotification): Promise<boolean> {
  return sendAdminNotification("Yeni yatirim talebi", 0xf1c40f, [
    { name: "Talep No", value: `#${input.depositId}`, inline: true },
    { name: "Uye ID", value: input.publicUserId ? String(input.publicUserId) : "-", inline: true },
    { name: "Tutar", value: `$${input.amount.toFixed(2)}`, inline: true },
    { name: "Ag", value: input.cryptoType.toUpperCase(), inline: true },
    { name: "E-posta", value: maskEmail(input.email), inline: false },
    { name: "Durum", value: "Beklemede", inline: true },
  ]);
}

export async function notifyNewWithdrawal(input: NewWithdrawalNotification): Promise<boolean> {
  return sendAdminNotification("Yeni cekim talebi", 0xe67e22, [
    { name: "Talep No", value: `#${input.withdrawalId}`, inline: true },
    { name: "Uye ID", value: input.publicUserId ? String(input.publicUserId) : "-", inline: true },
    { name: "Cekim tutari", value: `$${input.amount.toFixed(2)}`, inline: true },
    { name: "Kesinti", value: `$${input.fee.toFixed(2)}`, inline: true },
    { name: "E-posta", value: maskEmail(input.email), inline: false },
    { name: "Cuzdan", value: maskWallet(input.wallet), inline: false },
    { name: "Durum", value: "Beklemede", inline: true },
  ]);
}

export async function notifyNewUser(input: NewUserNotification): Promise<boolean> {
  return sendAdminNotification("Yeni kullanici kaydi", 0x2ecc71, [
    { name: "Uye ID", value: input.publicUserId ? String(input.publicUserId) : "-", inline: true },
    { name: "Isim", value: input.name, inline: true },
    { name: "E-posta", value: maskEmail(input.email), inline: false },
    { name: "Referans", value: input.referralCode || "Yok", inline: true },
  ]);
}

export async function notifyNewTicket(input: NewTicketNotification): Promise<boolean> {
  return sendAdminNotification("Yeni destek talebi", 0x3498db, [
    { name: "Talep No", value: `#${input.ticketId}`, inline: true },
    { name: "Uye ID", value: input.publicUserId ? String(input.publicUserId) : "-", inline: true },
    { name: "E-posta", value: input.email ? maskEmail(input.email) : "-", inline: false },
    { name: "Konu", value: input.subject, inline: false },
    { name: "Durum", value: "Acik", inline: true },
  ]);
}
