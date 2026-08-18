"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

import { canUseWebGlScene } from "@/components/portfolio/3d/capability";
import { SceneFallback } from "@/components/portfolio/3d/SceneFallback";

const HeroField = dynamic(
  () =>
    import("@/components/portfolio/3d/HeroField").then((mod) => mod.HeroField),
  { ssr: false, loading: () => <SceneFallback /> }
);

export function HeroScene() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(canUseWebGlScene());
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {enabled ? <HeroField /> : <SceneFallback />}
    </div>
  );
}
