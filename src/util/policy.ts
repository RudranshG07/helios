import { createHash } from "node:crypto";
import type { RiskConfig } from "../types/index.ts";

export function riskPolicyHash(risk: RiskConfig): string {
  const canonical = JSON.stringify(risk, Object.keys(risk).sort());
  return "0x" + createHash("sha256").update(canonical).digest("hex");
}
