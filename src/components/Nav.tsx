"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Home" },
  { href: "/loans", label: "Loans" },
  { href: "/plan", label: "Plan" },
  { href: "/compare", label: "Compare" },
  { href: "/help", label: "Get help" },
];

export function Nav() {
  const path = usePathname();
  if (path.startsWith("/welcome") || path.startsWith("/login")) return null;
  return (
    <nav className="fixed inset-x-0 bottom-0 border-t border-line bg-card">
      <ul className="mx-auto flex max-w-3xl justify-between px-2">
        {items.map((i) => {
          const active = i.href === "/" ? path === "/" : path.startsWith(i.href);
          return (
            <li key={i.href} className="flex-1">
              <Link href={i.href} className={`block py-3 text-center text-xs font-medium ${active ? "text-brand" : "text-muted"}`}>
                {i.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
