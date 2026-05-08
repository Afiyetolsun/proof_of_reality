"use client";

import { HeroOrbital } from "./HeroOrbital";
import { PlyHero } from "./PlyHero";

const PLY_SRC = "/splat/scene.ksplat";

// HeroOrbital plays as the placeholder while the .ksplat streams in (~7.6 MB,
// quantized from 74 MB .ply), then cross-fades to the real captured scene.
export function SplatHero() {
  return <PlyHero src={PLY_SRC} placeholder={<HeroOrbital />} />;
}
