"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CompareIcon, HeartIcon, HelpIcon, HomeIcon, MessageIcon, PlanIcon, UserIcon, WalletIcon, DocIcon } from "./Icons";
import { Logo } from "./Logo";
import { SaveErrors } from "./Session";

const MAIN = [
  { href: "/", label: "Home", Icon: HomeIcon },
  { href: "/loans", label: "Loans", Icon: WalletIcon },
  { href: "/plan", label: "My plan", Icon: PlanIcon },
  { href: "/help", label: "Get help", Icon: HelpIcon },
];
const MORE = [
  { href: "/compare", label: "Compare prices", Icon: CompareIcon },
  { href: "/money", label: "Money messages", Icon: MessageIcon },
  { href: "/profile", label: "My details", Icon: DocIcon },
  { href: "/account", label: "Account", Icon: UserIcon },
];

const isActive = (path: string, href: string) => (href === "/" ? path === "/" : path.startsWith(href));
// Full-screen flows without navigation.
const bareRoute = (path: string) => path.startsWith("/welcome") || path.startsWith("/login") || path.startsWith("/coach");

// The app frame. Phones: glass top bar and a floating glass tab bar.
// Tablets: a slim icon rail. Desktops: a frosted side menu with every screen.
export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  if (bareRoute(path)) {
    const wide = path.startsWith("/coach");
    return (
      <div className="min-h-screen">
        <header className="mx-auto flex max-w-5xl items-center px-4 pb-2 pt-5 md:px-8"><Link href="/"><Logo /></Link></header>
        <SaveErrors />
        <main key={path} className={`enter mx-auto px-4 pb-16 ${wide ? "max-w-3xl" : "max-w-xl"}`}>{children}</main>
      </div>
    );
  }
  return (
    <div className="min-h-screen">
      <SideNav path={path} />
      <div className="md:pl-[6.5rem] lg:pl-[18.5rem]">
        <header className="glass sticky top-0 z-20 flex items-center justify-between !rounded-none !border-x-0 !border-t-0 px-4 py-2.5 !shadow-none md:hidden">
          <Link href="/" aria-label="Home"><Logo /></Link>
          <Link href="/account" aria-label="Account" className={`flex h-10 w-10 items-center justify-center rounded-full border border-line bg-card ${path.startsWith("/account") ? "text-brand" : "text-muted"}`}>
            <UserIcon />
          </Link>
        </header>
        <div className="mx-auto max-w-5xl px-4 pt-3 md:px-8 md:pt-8"><SaveErrors /></div>
        <main key={path} className="enter mx-auto max-w-5xl px-4 pb-36 md:px-8 md:pb-16">{children}</main>
      </div>
      <TabBar path={path} />
    </div>
  );
}

function TabBar({ path }: { path: string }) {
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden">
      <ul className="glass mx-auto flex max-w-md justify-between rounded-[1.75rem] p-1.5">
        {MAIN.map(({ href, label, Icon }) => {
          const active = isActive(path, href);
          return (
            <li key={href} className="flex-1">
              <Link href={href} aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 rounded-[1.35rem] py-2 text-[11px] font-semibold transition-colors ${active ? "bg-brand-soft text-brand" : "text-muted hover:text-foreground"}`}>
                <Icon className="h-6 w-6" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function SideNav({ path }: { path: string }) {
  const item = (href: string, label: string, Icon: typeof HomeIcon) => {
    const active = isActive(path, href);
    return (
      <li key={href}>
        <Link href={href} aria-current={active ? "page" : undefined} title={label}
          className={`group flex flex-col items-center gap-1 rounded-2xl px-2 py-2.5 text-[11px] font-semibold transition-colors lg:flex-row lg:gap-3 lg:px-3 lg:text-[0.9375rem] ${active ? "bg-brand-soft text-brand" : "text-muted hover:bg-raised hover:text-foreground"}`}>
          <Icon className="h-6 w-6 shrink-0 lg:h-5 lg:w-5" />
          <span className="text-center lg:text-left">{label}</span>
        </Link>
      </li>
    );
  };
  return (
    <aside className="glass fixed bottom-3 left-3 top-3 z-30 hidden w-[5.5rem] flex-col rounded-[1.75rem] p-2.5 md:flex lg:w-[17rem] lg:p-4">
      <Link href="/" className="mb-5 flex justify-center pt-1 lg:justify-start lg:px-1" aria-label="Home">
        <span className="lg:hidden"><Logo compact /></span>
        <span className="hidden lg:inline-flex"><Logo /></span>
      </Link>
      <ul className="space-y-1">{MAIN.map((m) => item(m.href, m.label, m.Icon))}</ul>
      <p className="eyebrow mb-1 mt-6 hidden px-3 lg:block">More</p>
      <div className="mx-3 my-3 h-px bg-line lg:hidden" />
      <ul className="space-y-1">{MORE.map((m) => item(m.href, m.label, m.Icon))}</ul>
      <div className="mt-auto hidden rounded-2xl bg-brand-soft p-3.5 text-[0.8125rem] lg:block">
        <p className="flex items-center gap-1.5 font-semibold text-brand"><HeartIcon className="h-4 w-4" />We care</p>
        <p className="mt-1 text-foreground/75">We&apos;re on your side with every loan. Free, always.</p>
      </div>
    </aside>
  );
}
