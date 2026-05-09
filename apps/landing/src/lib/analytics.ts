type GtagFn = (...args: unknown[]) => void;

function g(...args: unknown[]) {
  if (typeof window === "undefined") return;
  const fn = (window as unknown as { gtag?: GtagFn }).gtag;
  if (typeof fn === "function") fn(...args);
}

export function trackEvent(name: string, params?: Record<string, unknown>) {
  g("event", name, params ?? {});
}

export function trackCtaClick(label: string, url: string, variant: string) {
  trackEvent("cta_click", { cta_label: label, cta_url: url, cta_variant: variant });
}

export function trackSectionView(sectionId: string) {
  trackEvent("section_view", { section_id: sectionId });
}

export function trackScrollDepth(percent: 25 | 50 | 75 | 90) {
  trackEvent("scroll_depth", { percent_scrolled: percent });
}

export function trackCookieConsent(value: "granted" | "declined") {
  trackEvent("cookie_consent", { consent_value: value });
}

export function trackFormStart(formName: string) {
  trackEvent("form_start", { form_name: formName });
}

export function trackFormSubmit(formName: string) {
  trackEvent("form_submit", { form_name: formName });
}

export function trackFormError(formName: string, errorCode: string) {
  trackEvent("form_error", { form_name: formName, error_code: errorCode });
}

export function trackGenerateLead(formName: string) {
  trackEvent("generate_lead", { form_name: formName, lead_type: "contact" });
}
