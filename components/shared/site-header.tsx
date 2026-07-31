"use client";

import * as React from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Badge } from "@/components/ui/badge";
import { NAV_LINKS, PRODUCT_LINKS, SITE } from "@/lib/constants";
import { cn } from "@/lib/utils";

function useScrolled(threshold = 8) {
  const [scrolled, setScrolled] = React.useState(false);
  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);
  return scrolled;
}

function ProductsMenu({
  onNavigate,
  className,
}: {
  onNavigate?: () => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1 p-2", className)}>
      {PRODUCT_LINKS.map((product) => {
        const comingSoon = (product.status as string) === "coming_soon";
        const classNameItem = cn(
          "rounded-lg px-3 py-2.5 text-left transition-colors",
          comingSoon
            ? "cursor-default opacity-80"
            : "hover:bg-charcoal/80"
        );
        const body = (
          <>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-ink">{product.label}</span>
              {comingSoon ? (
                <Badge variant="warning" className="text-[10px]">
                  Coming soon
                </Badge>
              ) : null}
            </div>
            <p className="mt-0.5 text-xs leading-snug text-ink-faint">
              {product.description}
            </p>
          </>
        );
        if (comingSoon) {
          return (
            <div key={product.id} className={classNameItem} aria-disabled>
              {body}
            </div>
          );
        }
        return (
          <Link
            key={product.id}
            href={product.href}
            onClick={onNavigate}
            className={classNameItem}
          >
            {body}
          </Link>
        );
      })}
    </div>
  );
}

export function SiteHeader() {
  const scrolled = useScrolled();
  const [open, setOpen] = React.useState(false);
  const [productsOpen, setProductsOpen] = React.useState(false);
  const productsRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!productsOpen) return;
    function onPointerDown(event: MouseEvent) {
      if (!productsRef.current?.contains(event.target as Node)) {
        setProductsOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setProductsOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [productsOpen]);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full transition-all duration-300",
        scrolled ? "sv-glass shadow-[0_1px_0_0_var(--sv-border)]" : "bg-transparent"
      )}
    >
      <Container className="flex h-16 items-center justify-between">
        <Link href="/studio" className="flex items-center gap-2.5 group">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/aftionix-logo.jpg"
            alt="AFTIONIX"
            className="h-9 w-9 shrink-0 rounded-lg object-cover ring-1 ring-border"
          />
          <span className="font-display text-lg font-semibold tracking-tight text-ink">
            {SITE.name}
          </span>
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          <div className="relative" ref={productsRef}>
            <button
              type="button"
              aria-expanded={productsOpen}
              aria-haspopup="menu"
              onClick={() => setProductsOpen((v) => !v)}
              className="inline-flex items-center gap-1 text-sm text-ink-dim transition-colors hover:text-ink"
            >
              Products
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 transition-transform",
                  productsOpen && "rotate-180"
                )}
              />
            </button>
            <AnimatePresence>
              {productsOpen ? (
                <motion.div
                  role="menu"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  transition={{ duration: 0.15 }}
                  className="sv-glass absolute left-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-xl border border-border shadow-[0_16px_40px_-20px_rgba(16,24,40,0.18)]"
                >
                  <ProductsMenu onNavigate={() => setProductsOpen(false)} />
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-ink-dim transition-colors hover:text-ink"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Link href="/sign-in">
            <Button variant="ghost" size="sm">
              Sign In
            </Button>
          </Link>
          <Link href="/sign-up">
            <Button variant="primary" size="sm">
              Get Started
            </Button>
          </Link>
        </div>

        <button
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
          className="flex h-10 w-10 items-center justify-center rounded-md text-ink md:hidden"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </Container>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-border sv-glass md:hidden"
          >
            <Container className="flex flex-col gap-4 py-6">
              <div>
                <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                  Products
                </p>
                <ProductsMenu onNavigate={() => setOpen(false)} />
              </div>
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="text-sm text-ink-dim hover:text-ink"
                >
                  {link.label}
                </Link>
              ))}
              <div className="mt-2 flex flex-col gap-3">
                <Link href="/sign-in" onClick={() => setOpen(false)}>
                  <Button variant="secondary" className="w-full">
                    Sign In
                  </Button>
                </Link>
                <Link href="/sign-up" onClick={() => setOpen(false)}>
                  <Button variant="primary" className="w-full">
                    Get Started
                  </Button>
                </Link>
              </div>
            </Container>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
