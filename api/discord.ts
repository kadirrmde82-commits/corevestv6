import { env } from "./lib/env";

type NewDepositNotification = {
  depositId: number;
  publicUserId?: number | null;
  amount: number;
  cryptoType: string;
  email: string;
};

function maskEmail(email: string): string {
  const [localPart, domain] = email.split("@");
  if (!domain) return "Gizli";
  const visible = localPart.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(3, localPart.length - visible.length))}@${domain}`;
}

export async function notifyNewDeposit(input: NewDepositNotification): Promise<void> {
  if (!env.discordWebhookUrl) return;

  const response = await fetch(env.discordWebhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(3_000),
    body: JSON.stringify({
      username: "Corevest Yatirim Bildirimleri",
      allowed_mentions: { parse: [] },
      embeds: [
        {
          title: "Yeni yatirim talebi",
          color: 0xf1c40f,
          fields: [
            { name: "Talep No", value: `#${input.depositId}`, inline: true },
            { name: "Uye ID", value: input.publicUserId ? String(input.publicUserId) : "-", inline: true },
            { name: "Tutar", value: `$${input.amount.toFixed(2)}`, inline: true },
            { name: "Ag", value: input.cryptoType.toUpperCase(), inline: true },
            { name: "E-posta", value: maskEmail(input.email), inline: false },
            { name: "Durum", value: "Beklemede", inline: true },
          ],
          timestamp: new Date().toISOString(),
          footer: { text: "Corevest Admin" },
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Discord webhook returned ${response.status}`);
  }
}
