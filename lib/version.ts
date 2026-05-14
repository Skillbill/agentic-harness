/**
 * Legge la versione corrente di AH dal package.json alla radice del repo.
 *
 * Usa `readFileSync` + JSON.parse invece di `import ... with { type: "json" }`
 * per evitare dipendenze da una syntax sperimentale di Node e per restare
 * compatibili con il loader TS di pi (jiti) qualunque versione di runtime
 * il dev abbia attiva.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export function readAhVersion(repoRoot: string): string {
  try {
    const raw = readFileSync(join(repoRoot, "package.json"), "utf-8");
    const pkg = JSON.parse(raw) as { version?: unknown };
    if (typeof pkg.version === "string" && pkg.version.length > 0) {
      return pkg.version;
    }
  } catch {
    // fallthrough
  }
  return "0.0.0";
}
