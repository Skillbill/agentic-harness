import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { execFileSync } from "node:child_process";

export type PlainPatternEntry = string[];

export interface TopologySpecialEntry {
  __special: "topology";
  topology_trigger: string;
  extra_patterns: string[];
}

export interface BroadWithContentFilterEntry {
  __special: "broad_with_content_filter";
  patterns: string[];
  content_filter: string;
}

export type PatternEntry =
  | PlainPatternEntry
  | TopologySpecialEntry
  | BroadWithContentFilterEntry;

export type PatternMap = Record<string, PatternEntry>;

export interface CacheDocEntry {
  commit: string;
  updatedAt: string;
}

export interface CacheState {
  docs: Record<string, CacheDocEntry>;
}

export interface DecideStaleOptions {
  topologyChanged?: boolean;
}

export const EXCLUDES: string[] = [
  "node_modules/**",
  ".git/**",
  ".gsd/**",
  ".pi/codebase/**",
  ".pi/**/.cache.json",
  "dist/**",
  "build/**",
  "out/**",
  ".next/**",
  "coverage/**",
  ".bg-shell/**",
  "*.log",
];

export const PATTERN_MAP: PatternMap = {
  "STACK.md": [
    "package.json",
    "**/package.json",
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    "requirements*.txt",
    "pyproject.toml",
    "Pipfile*",
    "tsconfig*.json",
    ".nvmrc",
    ".python-version",
    "Dockerfile*",
    "*.dockerfile",
    "docker-compose*.yml",
    "docker-compose*.yaml",
  ],
  "INTEGRAZIONI.md": [
    "package.json",
    "**/package.json",
    "**/.env.example",
    "**/.env.sample",
    "**/env.example",
    ".env.template",
    "**/*.openapi.yaml",
    "**/*.openapi.yml",
    "**/*.openapi.json",
    "**/openapi.yaml",
    "**/openapi.yml",
    "**/openapi.json",
  ],
  "ARCHITETTURA.md": [
    "**/index.ts",
    "**/index.tsx",
    "**/index.js",
    "**/index.jsx",
    "**/index.mts",
    "**/index.cjs",
    "**/index.mjs",
    "**/main.ts",
    "**/main.tsx",
    "**/main.js",
    "**/main.jsx",
    "**/main.mts",
    "**/app.ts",
    "**/app.tsx",
    "**/app.js",
    "**/server.ts",
    "**/server.js",
    "**/router.ts",
    "**/router.js",
    "src/**",
    "lib/**",
    "server/**",
    "app/**",
    "core/**",
    "domain/**",
  ],
  "STRUTTURA.md": {
    __special: "topology",
    topology_trigger: "git diff --diff-filter=AD <cached>..HEAD has any entry",
    extra_patterns: [
      ".gitignore",
      ".gitattributes",
      "README.md",
      "CONTRIBUTING.md",
      "AGENTS.md",
      "CLAUDE.md",
    ],
  },
  "CONVENZIONI.md": [
    ".eslintrc*",
    "eslint.config.*",
    ".prettierrc*",
    "prettier.config.*",
    "biome.json",
    ".editorconfig",
    ".stylelintrc*",
    "tsconfig*.json",
    ".flake8",
    ".pylintrc",
    "rustfmt.toml",
    ".rubocop.yml",
    ".golangci.yml",
    ".swiftlint.yml",
  ],
  "TESTING.md": [
    "**/*.test.ts",
    "**/*.test.tsx",
    "**/*.test.js",
    "**/*.test.jsx",
    "**/*.test.mts",
    "**/*.test.mjs",
    "**/*.test.cjs",
    "**/*.test.py",
    "**/*.spec.ts",
    "**/*.spec.tsx",
    "**/*.spec.js",
    "**/*.spec.jsx",
    "**/*.spec.mts",
    "**/*.spec.py",
    "**/__tests__/**",
    "tests/**",
    "test/**",
    "spec/**",
    "vitest.config.*",
    "jest.config.*",
    "playwright.config.*",
    "cypress.config.*",
    "karma.conf.*",
    "pytest.ini",
    "conftest.py",
    "tox.ini",
    ".github/workflows/*.yml",
    ".github/workflows/*.yaml",
  ],
  "CRITICITA.md": {
    __special: "broad_with_content_filter",
    content_filter:
      "diff line starts with '+' AND matches /(TODO|FIXME|HACK|XXX)/ OR file is a manifest",
    patterns: [
      "**/*.ts",
      "**/*.tsx",
      "**/*.js",
      "**/*.jsx",
      "**/*.mts",
      "**/*.mjs",
      "**/*.cjs",
      "**/*.py",
      "**/*.go",
      "**/*.rs",
      "**/*.rb",
      "**/*.java",
      "**/*.kt",
      "**/*.swift",
      "**/*.php",
      "**/*.c",
      "**/*.cpp",
      "**/*.h",
      "**/*.hpp",
      "package.json",
      "package-lock.json",
      "pnpm-lock.yaml",
      "yarn.lock",
      "requirements*.txt",
      "pyproject.toml",
      "Pipfile*",
    ],
  },
};

// ── Glob matcher (no external deps) ──

function globToRegex(glob: string): RegExp {
  let re = "";
  let i = 0;
  while (i < glob.length) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        // `**/` matches zero or more path segments
        if (glob[i + 2] === "/") {
          re += "(?:.*/)?";
          i += 3;
        } else {
          re += ".*";
          i += 2;
        }
      } else {
        re += "[^/]*";
        i += 1;
      }
    } else if (c === "?") {
      re += "[^/]";
      i += 1;
    } else if (".+^$()|[]{}\\".includes(c)) {
      re += "\\" + c;
      i += 1;
    } else {
      re += c;
      i += 1;
    }
  }
  return new RegExp("^" + re + "$");
}

function matchesAny(file: string, patterns: readonly string[]): boolean {
  for (const p of patterns) {
    if (globToRegex(p).test(file)) return true;
  }
  return false;
}

function isExcluded(file: string): boolean {
  return matchesAny(file, EXCLUDES);
}

function getPlainPatterns(entry: PatternEntry): string[] {
  if (Array.isArray(entry)) return entry;
  if (entry.__special === "topology") return entry.extra_patterns;
  return entry.patterns;
}

// ── Cache I/O ──

export function readCache(cachePath: string): CacheState | null {
  if (!existsSync(cachePath)) return null;
  try {
    const raw = readFileSync(cachePath, "utf-8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && parsed.docs && typeof parsed.docs === "object") {
      return parsed as CacheState;
    }
    return null;
  } catch {
    return null;
  }
}

export function writeCache(cachePath: string, state: CacheState): void {
  mkdirSync(dirname(cachePath), { recursive: true });
  const tmp = cachePath + ".tmp";
  writeFileSync(tmp, JSON.stringify(state, null, 2) + "\n", "utf-8");
  renameSync(tmp, cachePath);
}

// ── Git diff ──

export function diffSinceCachedCommit(cachedCommit: string, repoRoot: string): string[] {
  // If the cached commit no longer exists in history (rewritten / pruned),
  // fall back to "everything tracked" so the caller does a full rebuild.
  try {
    execFileSync("git", ["cat-file", "-e", `${cachedCommit}^{commit}`], {
      cwd: repoRoot,
      stdio: "ignore",
    });
  } catch {
    return listAllTrackedFiles(repoRoot);
  }

  try {
    const out = execFileSync("git", ["diff", "--name-only", `${cachedCommit}..HEAD`], {
      cwd: repoRoot,
      encoding: "utf-8",
    });
    return out.split("\n").map((s) => s.trim()).filter((s) => s.length > 0);
  } catch {
    return listAllTrackedFiles(repoRoot);
  }
}

function listAllTrackedFiles(repoRoot: string): string[] {
  try {
    const out = execFileSync("git", ["ls-files"], {
      cwd: repoRoot,
      encoding: "utf-8",
    });
    return out.split("\n").map((s) => s.trim()).filter((s) => s.length > 0);
  } catch {
    return [];
  }
}

// ── Stale-doc decision ──

export function decideStaleDocs(
  changedFiles: string[],
  patternMap: PatternMap = PATTERN_MAP,
  opts: DecideStaleOptions = {},
): Set<string> {
  const stale = new Set<string>();
  const relevant = changedFiles.filter((f) => !isExcluded(f));

  for (const [doc, entry] of Object.entries(patternMap)) {
    const patterns = getPlainPatterns(entry);
    if (relevant.some((f) => matchesAny(f, patterns))) {
      stale.add(doc);
    }
  }

  // STRUTTURA: topology trigger (add/delete) adds the doc even if no extra_patterns match.
  if (opts.topologyChanged) {
    for (const [doc, entry] of Object.entries(patternMap)) {
      if (!Array.isArray(entry) && entry.__special === "topology") {
        stale.add(doc);
      }
    }
  }

  return stale;
}
