"use client";

import dynamic from "next/dynamic";
import { useSyncExternalStore } from "react";

import { canUseWebGlScene } from "@/components/portfolio/3d/capability";
import { SceneFallback } from "@/components/portfolio/3d/SceneFallback";

const WorkspaceCanvas = dynamic(() => import("./WorkspaceCanvas"), {
  ssr: false,
  loading: () => <SceneFallback />,
});

function subscribe(onChange: () => void) {
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const mobile = window.matchMedia("(max-width: 767px)");
  motion.addEventListener("change", onChange);
  mobile.addEventListener("change", onChange);
  window.addEventListener("resize", onChange);
  return () => {
    motion.removeEventListener("change", onChange);
    mobile.removeEventListener("change", onChange);
    window.removeEventListener("resize", onChange);
  };
}

export function HeroScene() {
  const enabled = useSyncExternalStore(subscribe, canUseWebGlScene, () => false);

  return (
    <div
      className="pointer-events-none absolute inset-y-0 right-0 -z-10 w-full overflow-hidden lg:pointer-events-auto lg:w-[58%]"
      aria-hidden
    >
      {enabled ? <WorkspaceCanvas /> : <SceneFallback />}
    </div>
  );
}
