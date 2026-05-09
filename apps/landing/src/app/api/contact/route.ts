import { type NextRequest, NextResponse } from "next/server";
import { extractRequestMetadata, sendTelegramMessage } from "../../../lib/telegram";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { contact, message } = body as { contact?: unknown; message?: unknown };

  if (!contact || !message) {
    return NextResponse.json({ error: "Contact and message are required" }, { status: 400 });
  }
  if (typeof contact !== "string" || typeof message !== "string") {
    return NextResponse.json({ error: "Invalid input format" }, { status: 400 });
  }

  const metadata = extractRequestMetadata(req.headers);
  const sent = await sendTelegramMessage(contact.trim(), message.trim(), metadata);

  if (!sent) {
    return NextResponse.json({ error: "Failed to send message. Please try again later." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
