interface RequestMetadata {
  ip?: string;
  userAgent?: string;
  country?: string;
  city?: string;
  timezone?: string;
  referer?: string;
}

export function extractRequestMetadata(headers: Headers): RequestMetadata {
  const h = (key: string) => headers.get(key) ?? undefined;
  return {
    ip: h("cf-connecting-ip") ?? h("x-forwarded-for")?.split(",")[0]?.trim() ?? h("x-real-ip"),
    userAgent: h("user-agent"),
    country: h("cf-ipcountry"),
    city: h("cf-ipcity"),
    timezone: h("cf-timezone"),
    referer: h("referer"),
  };
}

function formatMetadata(m: RequestMetadata): string {
  const parts: string[] = [];
  if (m.ip) parts.push(`📍 IP: ${m.ip}`);
  if (m.country) parts.push(`🌍 Country: ${m.country}`);
  if (m.city) parts.push(`🏙️ City: ${m.city}`);
  if (m.timezone) parts.push(`🕐 Timezone: ${m.timezone}`);
  if (m.userAgent) parts.push(`💻 UA: ${m.userAgent}`);
  if (m.referer) parts.push(`🔗 Referer: ${m.referer}`);
  return parts.length ? `\n\n📊 Request info:\n${parts.join("\n")}` : "";
}

export async function sendTelegramMessage(
  contact: string,
  message: string,
  metadata?: RequestMetadata,
): Promise<boolean> {
  if (process.env.VERCEL_ENV !== "production") {
    console.log("[telegram] skipped — not production. contact:", contact);
    return true;
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.error("[telegram] TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set");
    return false;
  }

  const text = [
    "📬 *New contact — Proof of Reality*",
    "",
    `*Contact:* ${contact}`,
    "",
    "*Message:*",
    message,
    metadata ? formatMetadata(metadata) : "",
  ]
    .filter((l) => l !== undefined)
    .join("\n");

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
    });
    return res.ok;
  } catch (err) {
    console.error("[telegram] fetch error:", err);
    return false;
  }
}
