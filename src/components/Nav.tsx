"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CompareIcon, HelpIcon, HomeIcon, PlanIcon, WalletIcon } from "./Icons";

const items = [
  { href: "/", label: "Home", Icon: HomeIcon },
  { href: "/loans", label: "Loans", Icon: WalletIcon },
  { href: "/plan", label: "Plan", Icon: PlanIcon },
  { href: "/compare", label: "Compare", Icon: CompareIcon },
  { href: "/help", label: "Get help", Icon: HelpIcon },
];

export function Nav() {
  const path = usePathname();
  if (path.startsWith("/welcome") || path.startsWith("/login")) return null;
  return (
    <nav className="fixed inset-x-0 bottom-0 border-t border-line bg-card pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto flex max-w-3xl justify-between px-2">
        {items.map(({ href, label, Icon }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link href={href} aria-current={active ? "page" : undefined} className={`flex flex-col items-center gap-1 pb-2 pt-2.5 text-[11px] font-medium ${active ? "text-brand" : "text-muted hover:text-foreground"}`}>
                <Icon className="h-[22px] w-[22px]" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
