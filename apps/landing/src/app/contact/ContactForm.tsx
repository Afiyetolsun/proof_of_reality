"use client";

import { useRef, useState } from "react";
import {
  trackFormStart,
  trackFormSubmit,
  trackFormError,
  trackGenerateLead,
} from "../../lib/analytics";

const MAX_LENGTH = 500;

type Status = "idle" | "sending" | "success" | "error";

export function ContactForm() {
  const [contact, setContact] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [statusMsg, setStatusMsg] = useState("");
  const startedRef = useRef(false);

  function handleFirstInteraction() {
    if (startedRef.current) return;
    startedRef.current = true;
    trackFormStart("contact");
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!contact.trim()) {
      setStatus("error");
      setStatusMsg("Please provide a contact method (email, Telegram handle, etc.).");
      trackFormError("contact", "missing_contact");
      return;
    }
    if (!message.trim()) {
      setStatus("error");
      setStatusMsg("Please enter your message.");
      trackFormError("contact", "missing_message");
      return;
    }

    setStatus("sending");
    trackFormSubmit("contact");

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact: contact.trim(), message: message.trim() }),
      });

      if (res.ok) {
        setStatus("success");
        setStatusMsg("Message sent! We'll get back to you shortly.");
        trackGenerateLead("contact");
        setContact("");
        setMessage("");
        startedRef.current = false;
      } else {
        const data = await res.json().catch(() => ({}));
        const err = (data as { error?: string }).error ?? "Failed to send message. Please try again.";
        setStatus("error");
        setStatusMsg(err);
        trackFormError("contact", `http_${res.status}`);
      }
    } catch {
      setStatus("error");
      setStatusMsg("Network error. Please try again.");
      trackFormError("contact", "network_error");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <label htmlFor="contact" className="block text-mono-s text-[--color-ink-mute]">
          CONTACT METHOD
        </label>
        <input
          id="contact"
          type="text"
          value={contact}
          onChange={(e) => { handleFirstInteraction(); setContact(e.target.value); }}
          placeholder="your@email.com · @telegram · +1 234 567 890"
          required
          disabled={status === "sending"}
          className="w-full border border-[--color-rule] bg-[--color-surface-raised] px-4 py-3 text-body-s text-[--color-ink] placeholder:text-[--color-ink-faint] outline-none transition-colors focus:border-[--color-signal] disabled:opacity-50"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="message" className="flex items-baseline justify-between text-mono-s text-[--color-ink-mute]">
          <span>MESSAGE</span>
          <span className={message.length >= MAX_LENGTH ? "text-[--color-warn]" : "text-[--color-ink-faint]"}>
            {message.length}/{MAX_LENGTH}
          </span>
        </label>
        <textarea
          id="message"
          value={message}
          onChange={(e) => {
            if (e.target.value.length <= MAX_LENGTH) {
              handleFirstInteraction();
              setMessage(e.target.value);
            }
          }}
          placeholder="Tell us about your use case, question, or partnership idea…"
          required
          rows={6}
          disabled={status === "sending"}
          className="w-full border border-[--color-rule] bg-[--color-surface-raised] px-4 py-3 text-body-s text-[--color-ink] placeholder:text-[--color-ink-faint] outline-none transition-colors focus:border-[--color-signal] resize-y disabled:opacity-50"
        />
      </div>

      {statusMsg && (
        <p className={`text-mono-s ${status === "success" ? "text-[--color-signal]" : "text-[--color-warn]"}`}>
          {statusMsg}
        </p>
      )}

      <button
        type="submit"
        disabled={status === "sending"}
        className="border border-[--color-signal] px-6 py-3 text-mono-s text-[--color-signal] transition-colors hover:bg-[--color-signal] hover:text-[--color-surface-deep] disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {status === "sending" ? "Sending…" : "Send message →"}
      </button>

      <p className="text-mono-s text-[--color-ink-faint] leading-relaxed">
        Your contact details and message are processed under our{" "}
        <a href="/privacy" className="underline decoration-transparent hover:decoration-current transition-colors">
          Privacy Policy
        </a>
        , including IP-derived country for abuse prevention. See{" "}
        <a href="/terms" className="underline decoration-transparent hover:decoration-current transition-colors">
          Terms
        </a>
        .
      </p>
    </form>
  );
}
