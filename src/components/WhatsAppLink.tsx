// "Chat with us on WhatsApp" link to the Afueni WhatsApp number. Shows only
// once NEXT_PUBLIC_WHATSAPP_NUMBER is set (digits with country code, e.g. 254712345678).
const NUMBER = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "").replace(/\D/g, "");

export function whatsAppHref(text = "Hi Afueni"): string | null {
  return NUMBER ? `https://wa.me/${NUMBER}?text=${encodeURIComponent(text)}` : null;
}

export function WhatsAppLink({ text }: { text?: string }) {
  const href = whatsAppHref(text);
  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="card flex items-center gap-3 hover:border-good">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-good text-lg text-[#181a20]" aria-hidden>✆</span>
      <span className="text-sm">
        <span className="block font-semibold">Chat with Afueni on WhatsApp</span>
        <span className="text-muted">A coach replies within 2 hours, 8am to 8pm. Free for borrowers.</span>
      </span>
    </a>
  );
}
