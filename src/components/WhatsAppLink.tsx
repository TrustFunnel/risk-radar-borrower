import { ChatIcon } from "./Icons";
import { ChevronRight } from "./Icons";

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
    <a href={href} target="_blank" rel="noopener noreferrer" className="card flex items-center gap-3.5 !p-3.5">
      <span className="tile tile-good"><ChatIcon className="h-[22px] w-[22px]" /></span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">Chat on WhatsApp</span>
        <span className="block text-[0.8125rem] text-muted">A coach replies within 2 hours, 8am to 8pm. Free.</span>
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-muted" />
    </a>
  );
}
