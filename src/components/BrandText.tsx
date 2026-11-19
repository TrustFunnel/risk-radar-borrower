import { Fragment } from "react";

// Brand rule (Davine, 2026-11-17): "by Risk Radar" is always in italics,
// as in Afueni *by Risk Radar*. Wrap any text that may contain the brand.
export function BrandText({ children }: { children: string }) {
  const parts = children.split("by Risk Radar");
  return <>{parts.map((p, i) => <Fragment key={i}>{p}{i < parts.length - 1 ? <em>by Risk Radar</em> : null}</Fragment>)}</>;
}
