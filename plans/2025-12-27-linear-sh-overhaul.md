# Linear-sh Comprehensive Overhaul

## Overview

Complete modernization of linear-sh covering:
- **Linting**: Switch to oxlint + oxfmt, stricter TypeScript
- **Effect Migration**: Full Effect-first architecture
- **Multi-org/Profiles**: Profile support with org namespacing
- **Discovery Commands**: team/state/user list, config show
- **Testing**: Deep test infrastructure with mocks
- **Cleanup**: Remove old code, update docs

## Current State

### Architecture
```
src/
├── commands/           # Clipanion commands (mixed old/new patterns)
│   ├── base-command.ts # Uses old LinearService class
│   └── issue/          # Commands use context.service (Promise-based)
├── config.ts           # Loads config, no profile support
├── errors/             # Effect TaggedEnum errors ✓
├── linear/             # OLD: LinearService class (deprecated)
├── services/           # NEW: Effect layers ✓
│   ├── cache.ts        # CacheService layer
│   ├── config.ts       # ConfigService layer
│   ├── git.ts          # GitService layer
│   ├── linear-client.ts # LinearClientService layer
│   ├── linear.ts       # LinearService layer
│   └── output.ts       # OutputService layer
├── runtime/effect.ts   # CliContext bridge (hacky)
└── utils/              # Standalone utilities
```

### Key Discoveries
1. **Commands use old pattern**: `BaseCommand.buildContext()` creates class-based `LinearService`
2. **Effect partially integrated**: `runCommandEffect()` bridges old context to Effect
3. **No profile support**: Config has single `apiKey`, `defaults` - no named profiles
4. **Cache not org-namespaced**: `~/.cache/linear-sh/metadata-cache.json` shared across orgs
5. **Tests use mock layers**: Good pattern in `git.test.ts`, `linear.test.ts`

### Files to Delete After Migration
- `src/linear/client.ts` (old LinearService class)
- `src/linear/cache.ts` (old MetadataCache class)
- `src/linear/types.ts` (duplicated in services)
- `src/git/branch.ts` (replaced by GitService)
- `src/utils/logger.ts` (replaced by LoggerService)
- `src/utils/output.ts` (replaced by OutputService)

## Desired End State

```
src/
├── commands/
│   ├── base-command.ts     # Effect-native, provides layers
│   ├── issue/              # All Effect-based
│   └── profile/            # NEW: profile add/use/list/remove/show
├── config/
│   ├── schema.ts           # Config types with profiles
│   ├── loader.ts           # Load/merge config
│   └── profile.ts          # Profile management
├── errors/                 # Same
├── services/               # All services
│   ├── index.ts            # Exports + AppLayer composition
│   └── ...                 # Individual services
└── test/
    ├── preload.ts          # Network blocking
    ├── mocks/              # Mock factories
    │   ├── linear.ts
    │   ├── cache.ts
    │   └── git.ts
    └── layers.ts           # Test layer composition
```

### Verification
```bash
bun run check           # typecheck + lint + test
linear-sh profile list  # Shows profiles
linear-sh profile use work && linear-sh issue list  # Works
bun test                # All pass, no network calls
```

## Out of Scope

- OAuth/SSO authentication flows
- Multiple simultaneous orgs in one command
- Syncing profiles across machines
- GraphQL schema introspection
- Plugin system

---

# Phase 1: Linting & TypeScript Strictness

## Overview
Remove Biome, configure oxlint strictly, add oxfmt, tighten tsconfig.

## Prerequisites
- [ ] None

## Changes

### 1. Remove Biome
**File**: `package.json`

**Before**:
```json
"devDependencies": {
  "@biomejs/biome": "^1.8.3",
  ...
}
```

**After**:
```json
"devDependencies": {
  ...
}
```

**Also delete**: `biome.json`

### 2. Configure oxlint
**File**: `.oxlintrc.json`

**After** (replace entire file):
```json
{
  "$schema": "https://raw.githubusercontent.com/oxc-project/oxc/main/npm/oxlint/configuration_schema.json",
  "categories": {
    "correctness": "error",
    "suspicious": "error",
    "pedantic": "warn",
    "perf": "warn",
    "style": "off"
  },
  "plugins": ["typescript", "import", "promise"],
  "rules": {
    "typescript/no-explicit-any": "error",
    "typescript/no-unsafe-argument": "error",
    "typescript/no-unsafe-assignment": "error",
    "typescript/no-unsafe-call": "error",
    "typescript/no-unsafe-member-access": "error",
    "typescript/no-unsafe-return": "error",
    "typescript/explicit-function-return-type": "error",
    "typescript/no-floating-promises": "error",
    "typescript/no-misused-promises": "error",
    "typescript/ban-ts-comment": ["error", { "ts-expect-error": "allow-with-description" }],
    "typescript/no-this-alias": "off",
    
    "no-await-in-loop": "warn",
    "prefer-const": "error",
    "no-var": "error",
    "no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    
    "import/no-cycle": "error",
    "import/no-default-export": "off",
    
    "promise/no-floating-promises": "error"
  },
  "ignorePatterns": ["bin/**", "dist/**", "node_modules/**"]
}
```

### 3. Configure oxfmt
**File**: `.oxfmtrc.json` (new)

```json
{
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": true,
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all",
  "bracketSpacing": true
}
```

### 4. Stricter tsconfig
**File**: `tsconfig.json`

**Before**:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    ...
  }
}
```

**After**:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noPropertyAccessFromIndexSignature": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "rootDir": "./src",
    "outDir": "./dist",
    "types": ["bun-types"]
  },
  "include": ["src/**/*.ts"],
  "exclude": ["bin", "dist", "node_modules"]
}
```

### 5. Update package.json scripts
**File**: `package.json`

**Before**:
```json
"scripts": {
  "lint": "oxlint src/",
  "format": "bunx biome format --write .",
  ...
}
```

**After**:
```json
"scripts": {
  "build": "bun build ./src/index.ts --outfile ./bin/linear.mjs --target bun --minify",
  "lint": "oxlint src/",
  "lint:fix": "oxlint src/ --fix",
  "format": "oxfmt --write .",
  "format:check": "oxfmt --check .",
  "test": "bun test",
  "test:unit": "bun test --grep 'unit|accessor|pure'",
  "test:integration": "ALLOW_TEST_NETWORK=1 bun test --grep 'integration'",
  "typecheck": "bunx tsc --noEmit",
  "check": "bun run typecheck && bun run lint && bun run format:check && bun run test:unit"
}
```

### 6. Update .gitignore
**File**: `.gitignore`

**Add**:
```
# Build artifacts
linear-sh
index
*.bun-build
```

## Success Criteria

**Automated**:
```bash
bun run typecheck        # Zero errors
bun run lint             # Zero errors (after fixes)
bun run format:check     # Zero differences
```

**Manual**:
- [ ] `biome.json` deleted
- [ ] No `@biomejs/biome` in node_modules after `bun install`

## Rollback
```bash
git checkout HEAD -- package.json tsconfig.json .oxlintrc.json biome.json
```

---

# Phase 2: Config & Profile Schema

## Overview
Design and implement profile-aware configuration schema.

## Prerequisites
- [ ] Phase 1 complete

## Changes

### 1. Profile Schema Types
**File**: `src/config/schema.ts` (new)

```typescript
import { Data } from "effect";

// Output format for CLI
export type OutputFormat = "plain" | "json";

// Defaults that are org-specific
export interface ProfileDefaults {
  readonly teamId?: string;
  readonly assigneeId?: string;
  readonly workflowStateId?: string;
  readonly projectId?: string;
}

// A single profile configuration
export interface Profile {
  readonly apiKey: string;
  readonly apiHost?: string;
  readonly orgId?: string;           // Cached from viewer.organization.id
  readonly orgName?: string;         // Cached for display
  readonly defaults: ProfileDefaults;
}

// Full config file structure
export interface ConfigFile {
  readonly activeProfile?: string;
  readonly output?: OutputFormat;
  readonly profiles: Record<string, Profile>;
}

// Resolved runtime config (after merging env, files, flags)
export interface ResolvedConfig {
  readonly activeProfile: string;
  readonly profile: Profile;
  readonly output: OutputFormat;
  readonly paths: ConfigPaths;
}

export interface ConfigPaths {
  readonly configDir: string;       // ~/.config/linear-sh
  readonly configFile: string;      // ~/.config/linear-sh/config.json
  readonly cacheDir: string;        // ~/.cache/linear-sh/{orgId}
  readonly activeProfileFile: string; // ~/.config/linear-sh/active-profile
}

// Config file defaults
export const DEFAULT_PROFILE_NAME = "default";
export const DEFAULT_API_HOST = "https://api.linear.app/graphql";
export const DEFAULT_OUTPUT: OutputFormat = "plain";

export const emptyProfile = (): Profile => ({
  apiKey: "",
  apiHost: DEFAULT_API_HOST,
  defaults: {},
});

export const emptyConfigFile = (): ConfigFile => ({
  profiles: {},
});
```

### 2. Config Loader
**File**: `src/config/loader.ts` (new)

```typescript
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { Effect } from "effect";

import { ConfigError, type LinearError } from "../errors";
import {
  type ConfigFile,
  type ConfigPaths,
  type Profile,
  type ResolvedConfig,
  DEFAULT_API_HOST,
  DEFAULT_OUTPUT,
  DEFAULT_PROFILE_NAME,
  emptyConfigFile,
  emptyProfile,
} from "./schema";

// -----------------------------------------------------------------------------
// Path Resolution
// -----------------------------------------------------------------------------

export function getConfigPaths(homeDir = os.homedir()): Omit<ConfigPaths, "cacheDir"> & { baseCacheDir: string } {
  const configDir = path.join(homeDir, ".config", "linear-sh");
  return {
    configDir,
    configFile: path.join(configDir, "config.json"),
    activeProfileFile: path.join(configDir, "active-profile"),
    baseCacheDir: path.join(homeDir, ".cache", "linear-sh"),
  };
}

export function getCacheDir(baseCacheDir: string, orgId?: string): string {
  return orgId ? path.join(baseCacheDir, orgId) : baseCacheDir;
}

// -----------------------------------------------------------------------------
// File Operations
// -----------------------------------------------------------------------------

export function readConfigFile(filePath: string): ConfigFile | undefined {
  if (!existsSync(filePath)) {
    return undefined;
  }
  try {
    const content = readFileSync(filePath, "utf8");
    return JSON.parse(content) as ConfigFile;
  } catch {
    return undefined;
  }
}

export function writeConfigFile(filePath: string, config: ConfigFile): void {
  const dir = path.dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(filePath, JSON.stringify(config, null, 2), "utf8");
}

export function readActiveProfile(filePath: string): string | undefined {
  if (!existsSync(filePath)) {
    return undefined;
  }
  try {
    return readFileSync(filePath, "utf8").trim() || undefined;
  } catch {
    return undefined;
  }
}

export function writeActiveProfile(filePath: string, profileName: string): void {
  const dir = path.dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(filePath, profileName, "utf8");
}

// -----------------------------------------------------------------------------
// Environment Merging
// -----------------------------------------------------------------------------

interface EnvOverrides {
  apiKey?: string;
  apiHost?: string;
  profile?: string;
  output?: "plain" | "json";
  defaults: Partial<Profile["defaults"]>;
}

export function getEnvOverrides(env = process.env): EnvOverrides {
  return {
    apiKey: env.LINEAR_API_KEY,
    apiHost: env.LINEAR_API_HOST ?? env.LINEAR_API_BASE,
    profile: env.LINEAR_PROFILE,
    output: env.LINEAR_OUTPUT_FORMAT === "json" ? "json" : 
            env.LINEAR_OUTPUT_FORMAT === "plain" ? "plain" : undefined,
    defaults: {
      teamId: env.LINEAR_DEFAULT_TEAM_ID ?? env.LINEAR_TEAM_ID,
      assigneeId: env.LINEAR_DEFAULT_ASSIGNEE_ID,
      workflowStateId: env.LINEAR_DEFAULT_WORKFLOW_STATE_ID,
      projectId: env.LINEAR_DEFAULT_PROJECT_ID,
    },
  };
}

// -----------------------------------------------------------------------------
// Config Resolution
// -----------------------------------------------------------------------------

export interface LoadConfigOptions {
  readonly homeDir?: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly profileOverride?: string;
  readonly requireApiKey?: boolean;
}

export function loadConfig(options: LoadConfigOptions = {}): Effect.Effect<ResolvedConfig, LinearError> {
  return Effect.try({
    try: () => loadConfigSync(options),
    catch: (error) => ConfigError(
      error instanceof Error ? error.message : String(error)
    ),
  });
}

export function loadConfigSync(options: LoadConfigOptions = {}): ResolvedConfig {
  const homeDir = options.homeDir ?? os.homedir();
  const env = options.env ?? process.env;
  
  const paths = getConfigPaths(homeDir);
  const envOverrides = getEnvOverrides(env);
  
  // Load config file
  const configFile = readConfigFile(paths.configFile) ?? emptyConfigFile();
  
  // Determine active profile
  const activeProfile = 
    options.profileOverride ??
    envOverrides.profile ??
    readActiveProfile(paths.activeProfileFile) ??
    configFile.activeProfile ??
    DEFAULT_PROFILE_NAME;
  
  // Get profile, creating empty if doesn't exist
  const baseProfile = configFile.profiles[activeProfile] ?? emptyProfile();
  
  // Merge env overrides into profile
  const profile: Profile = {
    apiKey: envOverrides.apiKey ?? baseProfile.apiKey,
    apiHost: envOverrides.apiHost ?? baseProfile.apiHost ?? DEFAULT_API_HOST,
    orgId: baseProfile.orgId,
    orgName: baseProfile.orgName,
    defaults: {
      ...baseProfile.defaults,
      ...Object.fromEntries(
        Object.entries(envOverrides.defaults).filter(([, v]) => v !== undefined)
      ),
    },
  };
  
  // Validate
  if (options.requireApiKey !== false && !profile.apiKey) {
    throw new Error(
      "Linear API key is required. Set LINEAR_API_KEY or configure a profile."
    );
  }
  
  const cacheDir = getCacheDir(paths.baseCacheDir, profile.orgId);
  
  return {
    activeProfile,
    profile,
    output: envOverrides.output ?? configFile.output ?? DEFAULT_OUTPUT,
    paths: {
      configDir: paths.configDir,
      configFile: paths.configFile,
      cacheDir,
      activeProfileFile: paths.activeProfileFile,
    },
  };
}
```

### 3. Profile Manager
**File**: `src/config/profile.ts` (new)

```typescript
import { Effect } from "effect";
import { LinearClient } from "@linear/sdk";

import { ConfigError, LinearApiError, type LinearError } from "../errors";
import {
  type ConfigFile,
  type Profile,
  type ProfileDefaults,
  DEFAULT_API_HOST,
  emptyConfigFile,
} from "./schema";
import {
  getConfigPaths,
  getCacheDir,
  readConfigFile,
  writeConfigFile,
  readActiveProfile,
  writeActiveProfile,
} from "./loader";

// -----------------------------------------------------------------------------
// Profile Operations
// -----------------------------------------------------------------------------

export interface ProfileSummary {
  readonly name: string;
  readonly orgName?: string;
  readonly orgId?: string;
  readonly isActive: boolean;
  readonly hasApiKey: boolean;
}

export function listProfiles(homeDir?: string): ProfileSummary[] {
  const paths = getConfigPaths(homeDir);
  const config = readConfigFile(paths.configFile) ?? emptyConfigFile();
  const active = readActiveProfile(paths.activeProfileFile) ?? config.activeProfile ?? "default";
  
  return Object.entries(config.profiles).map(([name, profile]) => ({
    name,
    orgName: profile.orgName,
    orgId: profile.orgId,
    isActive: name === active,
    hasApiKey: Boolean(profile.apiKey),
  }));
}

export function getProfile(name: string, homeDir?: string): Profile | undefined {
  const paths = getConfigPaths(homeDir);
  const config = readConfigFile(paths.configFile) ?? emptyConfigFile();
  return config.profiles[name];
}

export function setActiveProfile(name: string, homeDir?: string): Effect.Effect<void, LinearError> {
  return Effect.try({
    try: () => {
      const paths = getConfigPaths(homeDir);
      const config = readConfigFile(paths.configFile) ?? emptyConfigFile();
      
      if (!config.profiles[name]) {
        throw new Error(`Profile "${name}" does not exist`);
      }
      
      writeActiveProfile(paths.activeProfileFile, name);
    },
    catch: (error) => ConfigError(
      error instanceof Error ? error.message : String(error)
    ),
  });
}

export interface AddProfileOptions {
  readonly name: string;
  readonly apiKey: string;
  readonly apiHost?: string;
  readonly defaults?: ProfileDefaults;
  readonly setActive?: boolean;
}

export function addProfile(options: AddProfileOptions, homeDir?: string): Effect.Effect<Profile, LinearError> {
  return Effect.gen(function* () {
    const paths = getConfigPaths(homeDir);
    const config = readConfigFile(paths.configFile) ?? emptyConfigFile();
    
    // Fetch org info from API
    const orgInfo = yield* fetchOrgInfo(options.apiKey, options.apiHost);
    
    const profile: Profile = {
      apiKey: options.apiKey,
      apiHost: options.apiHost ?? DEFAULT_API_HOST,
      orgId: orgInfo.id,
      orgName: orgInfo.name,
      defaults: options.defaults ?? {},
    };
    
    config.profiles[options.name] = profile;
    
    yield* Effect.try({
      try: () => writeConfigFile(paths.configFile, config),
      catch: (error) => ConfigError(`Failed to write config: ${String(error)}`),
    });
    
    if (options.setActive) {
      yield* setActiveProfile(options.name, homeDir);
    }
    
    return profile;
  });
}

export function removeProfile(name: string, homeDir?: string): Effect.Effect<void, LinearError> {
  return Effect.try({
    try: () => {
      const paths = getConfigPaths(homeDir);
      const config = readConfigFile(paths.configFile) ?? emptyConfigFile();
      
      if (!config.profiles[name]) {
        throw new Error(`Profile "${name}" does not exist`);
      }
      
      const active = readActiveProfile(paths.activeProfileFile) ?? config.activeProfile;
      if (active === name) {
        throw new Error(`Cannot remove active profile "${name}". Switch to another profile first.`);
      }
      
      delete config.profiles[name];
      writeConfigFile(paths.configFile, config);
      
      // Optionally: clean up cache for this profile's orgId
    },
    catch: (error) => ConfigError(
      error instanceof Error ? error.message : String(error)
    ),
  });
}

// -----------------------------------------------------------------------------
// API Helpers
// -----------------------------------------------------------------------------

interface OrgInfo {
  readonly id: string;
  readonly name: string;
}

function fetchOrgInfo(apiKey: string, apiHost?: string): Effect.Effect<OrgInfo, LinearError> {
  return Effect.tryPromise({
    try: async () => {
      const client = new LinearClient({
        apiKey,
        apiUrl: apiHost ?? DEFAULT_API_HOST,
      });
      
      const viewer = await client.viewer;
      const org = await viewer.organization;
      
      if (!org) {
        throw new Error("Could not fetch organization info");
      }
      
      return {
        id: org.id,
        name: org.name,
      };
    },
    catch: (error) => LinearApiError(
      `Failed to fetch organization: ${error instanceof Error ? error.message : String(error)}`,
      undefined,
      "fetchOrgInfo"
    ),
  });
}
```

### 4. Export Index
**File**: `src/config/index.ts` (new)

```typescript
export {
  type ConfigFile,
  type ConfigPaths,
  type OutputFormat,
  type Profile,
  type ProfileDefaults,
  type ResolvedConfig,
  DEFAULT_API_HOST,
  DEFAULT_OUTPUT,
  DEFAULT_PROFILE_NAME,
  emptyConfigFile,
  emptyProfile,
} from "./schema";

export {
  type LoadConfigOptions,
  getConfigPaths,
  getCacheDir,
  loadConfig,
  loadConfigSync,
  readConfigFile,
  writeConfigFile,
} from "./loader";

export {
  type AddProfileOptions,
  type ProfileSummary,
  addProfile,
  getProfile,
  listProfiles,
  removeProfile,
  setActiveProfile,
} from "./profile";
```

## Success Criteria

**Automated**:
```bash
bun run typecheck        # Zero errors
bun test src/config/     # Tests pass (write in Phase 5)
```

**Manual**:
- [ ] Can create `~/.config/linear-sh/config.json` with profile structure
- [ ] `loadConfigSync()` resolves profile from env/file

## Rollback
```bash
rm -rf src/config/
git checkout HEAD -- src/config.ts
```

---

# Phase 3: Update Services for Profiles

## Overview
Update ConfigService and CacheService to use profile-aware config.

## Prerequisites
- [ ] Phase 2 complete

## Changes

### 1. Update ConfigService
**File**: `src/services/config.ts`

**Before** (key parts):
```typescript
import { loadLinearConfig } from "../config";
// ...
export interface ConfigService {
  readonly get: () => Effect.Effect<LinearConfig, LinearError>;
  readonly getDefaults: () => Effect.Effect<LinearConfigDefaults, LinearError>;
  readonly getApiKey: () => Effect.Effect<string, LinearError>;
}
```

**After** (full replacement):
```typescript
import { Context, Effect, Layer } from "effect";

import {
  type LoadConfigOptions,
  type Profile,
  type ProfileDefaults,
  type ResolvedConfig,
  loadConfig,
} from "../config";
import { ConfigError, type LinearError } from "../errors";

// -----------------------------------------------------------------------------
// Service Interface
// -----------------------------------------------------------------------------

export interface ConfigService {
  /** Get the full resolved configuration */
  readonly getConfig: () => Effect.Effect<ResolvedConfig, LinearError>;

  /** Get the active profile */
  readonly getProfile: () => Effect.Effect<Profile, LinearError>;

  /** Get just the defaults section */
  readonly getDefaults: () => Effect.Effect<ProfileDefaults, LinearError>;

  /** Get the API key, failing if not present */
  readonly getApiKey: () => Effect.Effect<string, LinearError>;

  /** Get cache directory (org-namespaced) */
  readonly getCacheDir: () => Effect.Effect<string, LinearError>;

  /** Get active profile name */
  readonly getActiveProfileName: () => Effect.Effect<string, LinearError>;
}

// -----------------------------------------------------------------------------
// Context Tag
// -----------------------------------------------------------------------------

export const ConfigService = Context.GenericTag<ConfigService>(
  "linear-sh/services/ConfigService",
);

// -----------------------------------------------------------------------------
// Live Implementation
// -----------------------------------------------------------------------------

export const makeConfigServiceLive = (
  options: LoadConfigOptions = {},
): Layer.Layer<ConfigService, LinearError> =>
  Layer.effect(
    ConfigService,
    loadConfig(options).pipe(
      Effect.map((config) =>
        ConfigService.of({
          getConfig: () => Effect.succeed(config),

          getProfile: () => Effect.succeed(config.profile),

          getDefaults: () => Effect.succeed(config.profile.defaults),

          getApiKey: () =>
            config.profile.apiKey
              ? Effect.succeed(config.profile.apiKey)
              : Effect.fail(
                  ConfigError(
                    "Linear API key is required. Set LINEAR_API_KEY or configure a profile.",
                  ),
                ),

          getCacheDir: () => Effect.succeed(config.paths.cacheDir),

          getActiveProfileName: () => Effect.succeed(config.activeProfile),
        }),
      ),
    ),
  );

export const ConfigServiceLive: Layer.Layer<ConfigService, LinearError> =
  makeConfigServiceLive({ requireApiKey: false });

// -----------------------------------------------------------------------------
// Accessor functions
// -----------------------------------------------------------------------------

export const getConfig = (): Effect.Effect<ResolvedConfig, LinearError, ConfigService> =>
  Effect.flatMap(ConfigService, (service) => service.getConfig());

export const getProfile = (): Effect.Effect<Profile, LinearError, ConfigService> =>
  Effect.flatMap(ConfigService, (service) => service.getProfile());

export const getDefaults = (): Effect.Effect<ProfileDefaults, LinearError, ConfigService> =>
  Effect.flatMap(ConfigService, (service) => service.getDefaults());

export const getApiKey = (): Effect.Effect<string, LinearError, ConfigService> =>
  Effect.flatMap(ConfigService, (service) => service.getApiKey());

export const getCacheDir = (): Effect.Effect<string, LinearError, ConfigService> =>
  Effect.flatMap(ConfigService, (service) => service.getCacheDir());

export const getActiveProfileName = (): Effect.Effect<string, LinearError, ConfigService> =>
  Effect.flatMap(ConfigService, (service) => service.getActiveProfileName());
```

### 2. Update CacheService for org-namespacing
**File**: `src/services/cache.ts`

**Key change**: Use `getCacheDir()` from ConfigService instead of hardcoded path.

The `makeCacheServiceLive` already depends on ConfigService. Update it to use `getCacheDir`:

```typescript
// In makeCacheServiceLive, replace:
const cacheDir = path.join(homeDir, ".cache", "linear-sh");

// With:
const cacheDir = yield* configService.getCacheDir();
```

### 3. Update services/index.ts exports
**File**: `src/services/index.ts`

**Add** to ConfigService exports:
```typescript
export {
  ConfigService,
  ConfigServiceLive,
  makeConfigServiceLive,
  getConfig,
  getProfile,
  getDefaults,
  getApiKey,
  getCacheDir,
  getActiveProfileName,
} from "./config";
```

## Success Criteria

**Automated**:
```bash
bun run typecheck        # Zero errors
bun test src/services/   # Tests pass
```

**Manual**:
- [ ] ConfigService resolves profile from config file
- [ ] Cache files written to org-namespaced directory

---

# Phase 4: Effect-Native BaseCommand

## Overview
Rewrite BaseCommand to provide Effect layers instead of class instances.

## Prerequisites
- [ ] Phase 3 complete

## Changes

### 1. New CliRuntime module
**File**: `src/runtime/cli.ts` (new, replaces effect.ts)

```typescript
import { Effect, Layer, Runtime, Scope } from "effect";

import { type LinearError, toError } from "../errors";
import {
  CacheService,
  CacheServiceLive,
  ConfigService,
  makeConfigServiceLive,
  GitService,
  GitServiceLive,
  LinearClientService,
  LinearClientLive,
  LinearService,
  LinearServiceLive,
  LoggerService,
  LoggerServiceLive,
  OutputService,
  makeOutputServiceLive,
  type OutputServiceOptions,
} from "../services";

// -----------------------------------------------------------------------------
// App Layer Composition
// -----------------------------------------------------------------------------

export interface AppLayerOptions {
  readonly profileOverride?: string;
  readonly outputFormat?: "plain" | "json";
  readonly noCache?: boolean;
  readonly requireApiKey?: boolean;
}

export type AppServices = 
  | ConfigService 
  | CacheService 
  | LinearClientService 
  | LinearService 
  | GitService 
  | LoggerService 
  | OutputService;

export function makeAppLayer(
  options: AppLayerOptions = {},
): Layer.Layer<AppServices, LinearError> {
  const configLayer = makeConfigServiceLive({
    profileOverride: options.profileOverride,
    requireApiKey: options.requireApiKey,
  });

  const cacheLayer = options.noCache
    ? Layer.succeed(CacheService, {
        get: () => Effect.succeed(undefined),
        set: () => Effect.void,
        invalidate: () => Effect.void,
        clear: () => Effect.void,
      })
    : CacheServiceLive;

  const outputOptions: OutputServiceOptions = {
    format: options.outputFormat,
  };
  const outputLayer = makeOutputServiceLive(outputOptions);

  // Build layer graph
  return Layer.mergeAll(
    configLayer,
    GitServiceLive,
    LoggerServiceLive,
    outputLayer,
  ).pipe(
    Layer.provideMerge(cacheLayer),
    Layer.provideMerge(LinearClientLive),
    Layer.provideMerge(LinearServiceLive),
  );
}

// -----------------------------------------------------------------------------
// Command Runner
// -----------------------------------------------------------------------------

export interface RunOptions extends AppLayerOptions {
  readonly onError?: (error: Error) => void;
}

export async function runCommand<E, A>(
  program: Effect.Effect<A, E, AppServices>,
  options: RunOptions = {},
): Promise<A> {
  const layer = makeAppLayer(options);
  
  const runnable = Effect.provide(program, layer);
  
  const exit = await Effect.runPromiseExit(runnable);
  
  return Effect.Exit.match(exit, {
    onSuccess: (value) => value,
    onFailure: (cause) => {
      const error = toError(Effect.Cause.squash(cause));
      if (options.onError) {
        options.onError(error);
      }
      throw error;
    },
  });
}

export function runCommandExit<E>(
  program: Effect.Effect<number, E, AppServices>,
  options: RunOptions = {},
): Promise<number> {
  return runCommand(program, options).catch(() => 1);
}
```

### 2. Rewrite BaseCommand
**File**: `src/commands/base-command.ts`

**After** (full replacement):
```typescript
import { Command, Option } from "clipanion";
import { Effect } from "effect";

import { isLinearApiError, isConfigError, toErrorCode } from "../errors";
import {
  type AppServices,
  type AppLayerOptions,
  runCommandExit,
} from "../runtime/cli";
import { OutputService, error as outputError } from "../services";

export abstract class BaseCommand extends Command {
  json = Option.Boolean("--json", false, {
    description: "Emit machine-readable JSON output",
  });

  noCache = Option.Boolean("--no-cache", false, {
    description: "Disable metadata caching for this invocation",
  });

  profile = Option.String("--profile", {
    description: "Use a specific profile",
    required: false,
  });

  /**
   * Build layer options from command flags.
   */
  protected getLayerOptions(): AppLayerOptions {
    return {
      profileOverride: this.profile,
      outputFormat: this.json ? "json" : undefined,
      noCache: this.noCache,
      requireApiKey: true,
    };
  }

  /**
   * Run an Effect program with full app layer.
   */
  protected run<E>(
    program: Effect.Effect<number, E, AppServices>,
    options?: Partial<AppLayerOptions>,
  ): Promise<number> {
    const layerOptions = { ...this.getLayerOptions(), ...options };
    
    return runCommandExit(program, {
      ...layerOptions,
      onError: (error) => this.reportError(error),
    });
  }

  /**
   * Report an error to output.
   */
  private reportError(error: Error): void {
    // In error reporting, we can't use the full layer since it may have failed
    // Just write to stderr directly
    const message = error.message;
    const code = "code" in error ? String(error.code) : "ERROR";
    
    if (this.json) {
      console.error(JSON.stringify({ error: { message, code } }));
    } else {
      console.error(`Error: ${message}`);
    }
  }
}
```

### 3. Delete old runtime/effect.ts
**File**: `src/runtime/effect.ts`

**Delete** this file after migration.

## Success Criteria

**Automated**:
```bash
bun run typecheck        # Zero errors
```

**Manual**:
- [ ] Commands can extend BaseCommand and use `this.run(program)`
- [ ] Layers compose correctly

---

# Phase 5: Command Migration

## Overview
Migrate all issue commands to pure Effect.

## Prerequisites
- [ ] Phase 4 complete

## Changes

Each command follows this pattern:

**Before** (example: view):
```typescript
async execute(): Promise<number> {
  return this.withContext(async (context) => {
    const program = Effect.gen(function* () {
      const ctx = yield* CliContext;
      // ... uses ctx.service (old pattern)
    });
    return runCommandEffect(context, program);
  });
}
```

**After**:
```typescript
async execute(): Promise<number> {
  return this.run(
    Effect.gen(function* () {
      const linearService = yield* LinearService;
      const outputService = yield* OutputService;
      // ... uses Effect services directly
    })
  );
}
```

### Commands to Migrate (in order)

1. **IssueIdCommand** (`src/commands/issue/id.ts`) - simplest
2. **IssueTitleCommand** (`src/commands/issue/title.ts`)
3. **IssueUrlCommand** (`src/commands/issue/url.ts`)
4. **IssueViewCommand** (`src/commands/issue/view.ts`)
5. **IssueListCommand** (`src/commands/issue/list.ts`)
6. **IssueCreateCommand** (`src/commands/issue/create.ts`)
7. **IssueUpdateCommand** (`src/commands/issue/update.ts`)
8. **IssueStartCommand** (`src/commands/issue/start.ts`)
9. **IssuePrCommand** (`src/commands/issue/pr.ts`)
10. **RootCommand** (`src/index.ts`)

### Example: IssueViewCommand Migration

**File**: `src/commands/issue/view.ts`

**After**:
```typescript
import { Command, Option } from "clipanion";
import { Effect } from "effect";

import {
  GitService,
  LinearService,
  OutputService,
  getIssueDetails,
  inferIssueKey,
  write,
} from "../../services";
import { openInBrowser } from "../../utils/open";
import { ISSUE_USAGE_CATEGORY, IssueBaseCommand } from "./base";

export class IssueViewCommand extends IssueBaseCommand {
  static paths = [["issue", "view"]];

  static usage = Command.Usage({
    description: "Display Linear issue details",
    category: ISSUE_USAGE_CATEGORY,
    // ... same usage docs
  });

  open = Option.Boolean("-w,--web", false, {
    description: "Open the issue in the default browser",
  });

  async execute(): Promise<number> {
    const self = this;
    
    return this.run(
      Effect.gen(function* () {
        // Resolve issue ref (from arg or git branch)
        const issueRef = yield* self.resolveIssueRefEffect();
        
        // Fetch details
        const details = yield* getIssueDetails(issueRef);
        
        // Open in browser if requested
        if (self.open && details.url) {
          yield* Effect.promise(() => openInBrowser(details.url));
        }
        
        // Output
        if (self.json) {
          yield* write({ issue: details });
        } else {
          yield* write(formatIssueDetails(details));
        }
        
        return 0;
      })
    );
  }
}

// Move IssueBaseCommand.resolveIssueRefEffect to use Effect services
```

### Update IssueBaseCommand

**File**: `src/commands/issue/base.ts`

```typescript
import { Option } from "clipanion";
import { Effect } from "effect";

import { GitService, inferIssueKey } from "../../services";
import { ValidationError } from "../../errors";
import { BaseCommand } from "../base-command";

export const ISSUE_USAGE_CATEGORY = "Issue workflows";

export abstract class IssueBaseCommand extends BaseCommand {
  issueRef = Option.String({ required: false });

  protected resolveIssueRefEffect(fallbackToGit = true) {
    const ref = this.issueRef;
    
    return Effect.gen(function* () {
      if (ref) {
        return ref;
      }
      
      if (!fallbackToGit) {
        return yield* Effect.fail(
          ValidationError("Issue reference is required", "issueRef")
        );
      }
      
      const inferred = yield* inferIssueKey();
      
      if (!inferred) {
        return yield* Effect.fail(
          ValidationError(
            "Issue reference not provided and could not infer from Git branch",
            "issueRef"
          )
        );
      }
      
      return inferred;
    });
  }
}
```

## Success Criteria

**Automated**:
```bash
bun run typecheck        # Zero errors
bun test                 # All pass
linear-sh issue view     # Works
linear-sh issue list     # Works
```

---

# Phase 6: Profile Commands

## Overview
Add CLI commands for profile management.

## Prerequisites
- [ ] Phase 5 complete (at least BaseCommand)

## Changes

### 1. Profile List Command
**File**: `src/commands/profile/list.ts` (new)

```typescript
import { Command } from "clipanion";
import { Effect } from "effect";

import { listProfiles } from "../../config";
import { write } from "../../services";
import { BaseCommand } from "../base-command";

export class ProfileListCommand extends BaseCommand {
  static paths = [["profile", "list"]];

  static usage = Command.Usage({
    description: "List configured profiles",
    examples: [["List all profiles", "linear-sh profile list"]],
  });

  async execute(): Promise<number> {
    const self = this;
    
    return this.run(
      Effect.gen(function* () {
        const profiles = listProfiles();
        
        if (self.json) {
          yield* write({ profiles });
        } else {
          if (profiles.length === 0) {
            yield* write("No profiles configured. Run `linear-sh profile add` to create one.");
          } else {
            const lines = profiles.map((p) => {
              const active = p.isActive ? " (active)" : "";
              const org = p.orgName ? ` [${p.orgName}]` : "";
              return `${p.name}${org}${active}`;
            });
            yield* write(lines.join("\n"));
          }
        }
        
        return 0;
      }),
      { requireApiKey: false }
    );
  }
}
```

### 2. Profile Add Command
**File**: `src/commands/profile/add.ts` (new)

```typescript
import { Command, Option } from "clipanion";
import { Effect } from "effect";
import enquirer from "enquirer";

import { addProfile } from "../../config";
import { write, success } from "../../services";
import { BaseCommand } from "../base-command";

export class ProfileAddCommand extends BaseCommand {
  static paths = [["profile", "add"]];

  static usage = Command.Usage({
    description: "Add a new profile",
    examples: [
      ["Interactive", "linear-sh profile add"],
      ["With options", "linear-sh profile add --name work --api-key lin_api_xxx --set-active"],
    ],
  });

  name = Option.String("--name", {
    description: "Profile name",
    required: false,
  });

  apiKey = Option.String("--api-key", {
    description: "Linear API key",
    required: false,
  });

  setActive = Option.Boolean("--set-active", false, {
    description: "Set as active profile after adding",
  });

  async execute(): Promise<number> {
    const self = this;
    
    return this.run(
      Effect.gen(function* () {
        let name = self.name;
        let apiKey = self.apiKey;
        
        // Interactive prompts if needed
        if (!name || !apiKey) {
          const responses = yield* Effect.promise(() =>
            (enquirer as { prompt: Function }).prompt([
              {
                type: "input",
                name: "name",
                message: "Profile name",
                initial: name ?? "default",
                skip: Boolean(name),
              },
              {
                type: "password",
                name: "apiKey",
                message: "Linear API key",
                skip: Boolean(apiKey),
              },
            ])
          );
          
          name = name ?? (responses as { name: string }).name;
          apiKey = apiKey ?? (responses as { apiKey: string }).apiKey;
        }
        
        if (!name || !apiKey) {
          yield* write("Profile name and API key are required.");
          return 1;
        }
        
        const profile = yield* addProfile({
          name,
          apiKey,
          setActive: self.setActive,
        });
        
        if (self.json) {
          yield* write({ profile: { name, orgId: profile.orgId, orgName: profile.orgName } });
        } else {
          yield* success(`Profile "${name}" added`, {
            organization: profile.orgName ?? profile.orgId,
            active: self.setActive,
          });
        }
        
        return 0;
      }),
      { requireApiKey: false }
    );
  }
}
```

### 3. Profile Use Command
**File**: `src/commands/profile/use.ts` (new)

```typescript
import { Command, Option } from "clipanion";
import { Effect } from "effect";

import { setActiveProfile, getProfile } from "../../config";
import { write, success } from "../../services";
import { BaseCommand } from "../base-command";

export class ProfileUseCommand extends BaseCommand {
  static paths = [["profile", "use"]];

  static usage = Command.Usage({
    description: "Switch active profile",
    examples: [["Switch to work", "linear-sh profile use work"]],
  });

  name = Option.String({ required: true });

  async execute(): Promise<number> {
    const self = this;
    
    return this.run(
      Effect.gen(function* () {
        yield* setActiveProfile(self.name);
        
        const profile = getProfile(self.name);
        
        if (self.json) {
          yield* write({ activeProfile: self.name, orgName: profile?.orgName });
        } else {
          yield* success(`Switched to profile "${self.name}"`, {
            organization: profile?.orgName,
          });
        }
        
        return 0;
      }),
      { requireApiKey: false }
    );
  }
}
```

### 4. Profile Remove Command
**File**: `src/commands/profile/remove.ts` (new)

```typescript
import { Command, Option } from "clipanion";
import { Effect } from "effect";

import { removeProfile } from "../../config";
import { write, success } from "../../services";
import { BaseCommand } from "../base-command";

export class ProfileRemoveCommand extends BaseCommand {
  static paths = [["profile", "remove"]];

  static usage = Command.Usage({
    description: "Remove a profile",
    examples: [["Remove old profile", "linear-sh profile remove old"]],
  });

  name = Option.String({ required: true });

  async execute(): Promise<number> {
    const self = this;
    
    return this.run(
      Effect.gen(function* () {
        yield* removeProfile(self.name);
        
        if (self.json) {
          yield* write({ removed: self.name });
        } else {
          yield* success(`Removed profile "${self.name}"`);
        }
        
        return 0;
      }),
      { requireApiKey: false }
    );
  }
}
```

### 5. Profile Show Command
**File**: `src/commands/profile/show.ts` (new)

```typescript
import { Command } from "clipanion";
import { Effect } from "effect";

import { getConfig, write } from "../../services";
import { BaseCommand } from "../base-command";

export class ProfileShowCommand extends BaseCommand {
  static paths = [["profile", "show"], ["config", "show"]];

  static usage = Command.Usage({
    description: "Show resolved configuration for active profile",
    examples: [["Show config", "linear-sh profile show"]],
  });

  async execute(): Promise<number> {
    const self = this;
    
    return this.run(
      Effect.gen(function* () {
        const config = yield* getConfig();
        
        if (self.json) {
          yield* write({
            activeProfile: config.activeProfile,
            profile: {
              orgId: config.profile.orgId,
              orgName: config.profile.orgName,
              apiHost: config.profile.apiHost,
              defaults: config.profile.defaults,
            },
            output: config.output,
            paths: config.paths,
          });
        } else {
          const lines = [
            `Profile: ${config.activeProfile}`,
            `Organization: ${config.profile.orgName ?? config.profile.orgId ?? "(unknown)"}`,
            `API Host: ${config.profile.apiHost}`,
            `Output Format: ${config.output}`,
            "",
            "Defaults:",
          ];
          
          const defaults = config.profile.defaults;
          if (defaults.teamId) lines.push(`  Team: ${defaults.teamId}`);
          if (defaults.assigneeId) lines.push(`  Assignee: ${defaults.assigneeId}`);
          if (defaults.workflowStateId) lines.push(`  State: ${defaults.workflowStateId}`);
          if (defaults.projectId) lines.push(`  Project: ${defaults.projectId}`);
          
          if (Object.keys(defaults).length === 0) {
            lines.push("  (none)");
          }
          
          yield* write(lines.join("\n"));
        }
        
        return 0;
      }),
      { requireApiKey: false }
    );
  }
}
```

### 6. Register Commands
**File**: `src/index.ts`

**Add imports and registration**:
```typescript
import { ProfileAddCommand } from "./commands/profile/add";
import { ProfileListCommand } from "./commands/profile/list";
import { ProfileRemoveCommand } from "./commands/profile/remove";
import { ProfileShowCommand } from "./commands/profile/show";
import { ProfileUseCommand } from "./commands/profile/use";

// In commandClasses array:
const commandClasses = [
  // ... existing commands
  ProfileAddCommand,
  ProfileListCommand,
  ProfileRemoveCommand,
  ProfileShowCommand,
  ProfileUseCommand,
];
```

## Success Criteria

**Automated**:
```bash
bun run typecheck
linear-sh profile list --json  # Works
```

**Manual**:
- [ ] `linear-sh profile add --name test --api-key xxx` creates profile
- [ ] `linear-sh profile use test` switches profile
- [ ] `linear-sh profile show` displays config
- [ ] `linear-sh profile remove test` removes profile

---

# Phase 7: Discovery Commands

## Overview
Add team list, state list, user list commands.

## Prerequisites
- [ ] Phase 5 complete

## Changes

### 1. Team List Command
**File**: `src/commands/team/list.ts` (new)

```typescript
import { Command } from "clipanion";
import { Effect } from "effect";

import { getTeams, write } from "../../services";
import { BaseCommand } from "../base-command";

export class TeamListCommand extends BaseCommand {
  static paths = [["team", "list"]];

  static usage = Command.Usage({
    description: "List teams in the organization",
    examples: [["List teams", "linear-sh team list"]],
  });

  async execute(): Promise<number> {
    const self = this;
    
    return this.run(
      Effect.gen(function* () {
        const teams = yield* getTeams();
        
        if (self.json) {
          yield* write({ teams });
        } else {
          if (teams.length === 0) {
            yield* write("No teams found.");
          } else {
            const lines = teams.map((t) => `${t.key.padEnd(8)} ${t.name} (${t.id})`);
            yield* write(lines.join("\n"));
          }
        }
        
        return 0;
      })
    );
  }
}
```

### 2. State List Command
**File**: `src/commands/state/list.ts` (new)

```typescript
import { Command, Option } from "clipanion";
import { Effect } from "effect";

import { getWorkflowStates, getConfig, write } from "../../services";
import { BaseCommand } from "../base-command";

export class StateListCommand extends BaseCommand {
  static paths = [["state", "list"]];

  static usage = Command.Usage({
    description: "List workflow states",
    examples: [
      ["List all states", "linear-sh state list"],
      ["List for team", "linear-sh state list --team TEAM-ID"],
    ],
  });

  team = Option.String("--team", {
    description: "Filter by team ID",
    required: false,
  });

  async execute(): Promise<number> {
    const self = this;
    
    return this.run(
      Effect.gen(function* () {
        const config = yield* getConfig();
        const teamId = self.team ?? config.profile.defaults.teamId;
        
        const states = yield* getWorkflowStates(teamId);
        
        if (self.json) {
          yield* write({ states });
        } else {
          if (states.length === 0) {
            yield* write("No workflow states found.");
          } else {
            const lines = states.map((s) => 
              `${s.name.padEnd(20)} [${s.type.padEnd(10)}] ${s.id}`
            );
            yield* write(lines.join("\n"));
          }
        }
        
        return 0;
      })
    );
  }
}
```

### 3. User List Command
**File**: `src/commands/user/list.ts` (new)

```typescript
import { Command, Option } from "clipanion";
import { Effect } from "effect";

import { getUsers, getConfig, write } from "../../services";
import { BaseCommand } from "../base-command";

export class UserListCommand extends BaseCommand {
  static paths = [["user", "list"]];

  static usage = Command.Usage({
    description: "List users",
    examples: [["List users", "linear-sh user list"]],
  });

  team = Option.String("--team", {
    description: "Filter by team ID",
    required: false,
  });

  async execute(): Promise<number> {
    const self = this;
    
    return this.run(
      Effect.gen(function* () {
        const config = yield* getConfig();
        const teamId = self.team ?? config.profile.defaults.teamId;
        
        const users = yield* getUsers(teamId);
        
        if (self.json) {
          yield* write({ users });
        } else {
          if (users.length === 0) {
            yield* write("No users found.");
          } else {
            const lines = users.map((u) => 
              `${u.name.padEnd(25)} ${u.email ?? ""} (${u.id})`
            );
            yield* write(lines.join("\n"));
          }
        }
        
        return 0;
      })
    );
  }
}
```

### 4. Register Commands
**File**: `src/index.ts`

Add imports and register commands.

## Success Criteria

```bash
linear-sh team list          # Works
linear-sh state list         # Works
linear-sh user list          # Works
linear-sh team list --json   # JSON output
```

---

# Phase 8: Test Infrastructure

## Overview
Build comprehensive test infrastructure with mocks and layers.

## Prerequisites
- [ ] Phase 5 complete

## Changes

### 1. Mock Factories
**File**: `src/test/mocks/linear.ts` (new)

```typescript
import { Effect } from "effect";

import type { LinearClientService, LinearService } from "../../services";

export interface MockIssue {
  id: string;
  identifier: string;
  title: string;
  url: string;
  description?: string;
  branchName?: string;
}

export const mockIssue = (overrides: Partial<MockIssue> = {}): MockIssue => ({
  id: "issue-123",
  identifier: "TEST-123",
  title: "Test Issue",
  url: "https://linear.app/test/issue/TEST-123",
  ...overrides,
});

export const mockLinearClientService = (
  overrides: Partial<LinearClientService> = {},
): LinearClientService => ({
  client: null as never,
  getIssue: () => Effect.succeed(mockIssue()),
  searchIssues: () => Effect.succeed([mockIssue()]),
  listIssues: () => Effect.succeed([mockIssue()]),
  createIssue: () => Effect.succeed(mockIssue()),
  updateIssue: () => Effect.succeed(mockIssue()),
  createComment: () => Effect.succeed({ id: "comment-1" }),
  getWorkflowStates: () => Effect.succeed([
    { id: "state-1", name: "Backlog", type: "backlog" },
    { id: "state-2", name: "In Progress", type: "started" },
    { id: "state-3", name: "Done", type: "completed" },
  ]),
  getUsers: () => Effect.succeed([
    { id: "user-1", name: "Alice", email: "alice@test.com", displayName: "Alice" },
  ]),
  getTeams: () => Effect.succeed([
    { id: "team-1", name: "Engineering", key: "ENG" },
  ]),
  ...overrides,
});
```

### 2. Mock Cache
**File**: `src/test/mocks/cache.ts` (new)

```typescript
import { Effect } from "effect";

import type { CacheService } from "../../services";

export const mockCacheService = (): CacheService => {
  const store = new Map<string, unknown>();
  
  return {
    get: <T>(key: string) => Effect.succeed(store.get(key) as T | undefined),
    set: <T>(key: string, value: T) => {
      store.set(key, value);
      return Effect.void;
    },
    invalidate: (key: string) => {
      store.delete(key);
      return Effect.void;
    },
    clear: () => {
      store.clear();
      return Effect.void;
    },
  };
};
```

### 3. Test Layers
**File**: `src/test/layers.ts` (new)

```typescript
import { Layer } from "effect";

import {
  CacheService,
  ConfigService,
  GitService,
  LinearClientService,
  LinearService,
  LinearServiceLive,
  LoggerService,
  LoggerServiceSilent,
  OutputService,
  type ResolvedConfig,
} from "../services";
import { mockCacheService } from "./mocks/cache";
import { mockLinearClientService } from "./mocks/linear";

export const mockConfig: ResolvedConfig = {
  activeProfile: "test",
  profile: {
    apiKey: "test-api-key",
    apiHost: "https://api.linear.app/graphql",
    orgId: "org-123",
    orgName: "Test Org",
    defaults: {
      teamId: "team-1",
    },
  },
  output: "plain",
  paths: {
    configDir: "/tmp/linear-sh",
    configFile: "/tmp/linear-sh/config.json",
    cacheDir: "/tmp/linear-sh/cache",
    activeProfileFile: "/tmp/linear-sh/active-profile",
  },
};

export const MockConfigLayer = Layer.succeed(ConfigService, {
  getConfig: () => Effect.succeed(mockConfig),
  getProfile: () => Effect.succeed(mockConfig.profile),
  getDefaults: () => Effect.succeed(mockConfig.profile.defaults),
  getApiKey: () => Effect.succeed(mockConfig.profile.apiKey),
  getCacheDir: () => Effect.succeed(mockConfig.paths.cacheDir),
  getActiveProfileName: () => Effect.succeed(mockConfig.activeProfile),
});

export const MockCacheLayer = Layer.succeed(CacheService, mockCacheService());

export const MockLinearClientLayer = Layer.succeed(
  LinearClientService,
  mockLinearClientService(),
);

export const MockGitLayer = Layer.succeed(GitService, {
  getCurrentBranch: () => Effect.succeed("main"),
  createBranch: () => Effect.void,
  checkoutBranch: () => Effect.void,
  branchExists: () => Effect.succeed(false),
  inferIssueKey: () => Effect.succeed(null),
});

export const MockOutputLayer = Layer.succeed(OutputService, {
  write: () => Effect.void,
  success: () => Effect.void,
  info: () => Effect.void,
  warn: () => Effect.void,
  error: () => Effect.void,
  getFormat: () => Effect.succeed("plain" as const),
});

/**
 * Complete test layer with all services mocked.
 */
export const TestLayer = Layer.mergeAll(
  MockConfigLayer,
  MockCacheLayer,
  MockLinearClientLayer,
  MockGitLayer,
  MockOutputLayer,
  LoggerServiceSilent,
).pipe(
  Layer.provideMerge(LinearServiceLive),
);

/**
 * Run an effect with the test layer.
 */
export const runTest = <A, E>(effect: Effect.Effect<A, E, any>) =>
  Effect.runPromise(Effect.provide(effect, TestLayer));
```

### 4. Update test/preload.ts
**File**: `test/preload.ts`

```typescript
const originalFetch = globalThis.fetch?.bind(globalThis);

globalThis.fetch = (async (...args: Parameters<typeof fetch>) => {
  if (process.env.ALLOW_TEST_NETWORK === "1") {
    if (!originalFetch) {
      throw new Error("fetch is not available in this environment");
    }
    return originalFetch(...args);
  }

  const target = typeof args[0] === "string" ? args[0] : args[0].toString();
  
  // Log blocked requests in CI for debugging
  if (process.env.CI) {
    console.error(`[TEST] Network blocked: ${target}`);
  }
  
  throw new Error(
    `Network access blocked during tests (attempted to fetch ${target}). ` +
    `Use mock layers or set ALLOW_TEST_NETWORK=1 for integration tests.`
  );
}) as typeof fetch;
```

## Success Criteria

```bash
bun test                        # All pass
bun test:unit                   # Unit tests only
ALLOW_TEST_NETWORK=1 bun test   # Integration tests (manual)
```

---

# Phase 9: Cleanup & Documentation

## Overview
Delete old files, update docs.

## Prerequisites
- [ ] All previous phases complete
- [ ] All tests passing

## Changes

### 1. Delete Old Files

```bash
rm src/config.ts                    # Replaced by src/config/
rm src/config.test.ts               # Migrate tests first
rm src/linear/client.ts             # Replaced by services/linear.ts
rm src/linear/client.test.ts        # Migrate tests first
rm src/linear/cache.ts              # Replaced by services/cache.ts
rm src/linear/cache.test.ts         # Migrate tests first
rm src/linear/types.ts              # Duplicated in services
rm src/git/branch.ts                # Replaced by services/git.ts
rm src/git/branch.test.ts           # Already migrated
rm src/utils/logger.ts              # Replaced by services/logger.ts
rm src/utils/output.ts              # Replaced by services/output.ts
rm src/utils/output.test.ts         # Migrate tests first
rm src/runtime/effect.ts            # Replaced by runtime/cli.ts
rm src/commands/issue/helpers.ts    # Inlined into commands or services
rmdir src/linear/                   # After removing files
rmdir src/git/                      # After removing files
```

### 2. Update AGENTS.md

Update architecture section to reflect new structure.

### 3. Update README.md

Add profile usage examples.

## Success Criteria

```bash
bun run check                # All pass
fd -e ts . src --type f      # No old files
```

---

# Testing Strategy

## Unit Tests

Each service has corresponding `.test.ts` with:
- Mock layer injection
- All public methods tested
- Error cases tested

## Integration Tests

Mark with `describe.skip` by default, run with `ALLOW_TEST_NETWORK=1`:
- Real API calls to sandbox org
- Profile switching
- Cache behavior

## Manual Testing Checklist

1. [ ] Fresh install: `rm -rf ~/.config/linear-sh ~/.cache/linear-sh`
2. [ ] `linear-sh` shows "no API key" message
3. [ ] `linear-sh profile add` creates profile interactively
4. [ ] `linear-sh issue list` works with new profile
5. [ ] `linear-sh profile add --name work` adds second profile
6. [ ] `linear-sh profile use work` switches
7. [ ] Cache isolated per org

---

# Anti-Patterns to Avoid

1. **Don't mix old/new patterns** - Once a file is migrated, don't import from old locations
2. **Don't use `context.service`** - Use Effect accessors
3. **Don't hardcode paths** - Use ConfigService.getCacheDir()
4. **Don't swallow errors** - Let Effect propagate, handle at command level

---

# Open Questions

- [x] oxfmt config format? → JSON with .oxfmtrc.json
- [x] Keep biome for anything? → No, full switch to ox* tools
- [ ] Profile storage format versioning? → Future consideration
- [ ] Migration path for existing users? → Detect old config, auto-migrate

---

# References

- Existing issues: `bd list --status open`
- Effect docs: https://effect.website
- oxlint rules: `npx oxlint --rules`
- Linear SDK: https://developers.linear.app/docs/sdk

# Linear-sh Comprehensive Overhaul

## Overview

Complete modernization of linear-sh covering:
- **Linting**: Switch to oxlint + oxfmt, stricter TypeScript
- **Effect Migration**: Full Effect-first architecture
- **Multi-org/Profiles**: Profile support with org namespacing
- **Discovery Commands**: team/state/user list, config show
- **Testing**: Deep test infrastructure with mocks
- **Cleanup**: Remove old code, update docs

## Current State

### Architecture
```
src/
├── commands/           # Clipanion commands (mixed old/new patterns)
│   ├── base-command.ts # Uses old LinearService class
│   └── issue/          # Commands use context.service (Promise-based)
├── config.ts           # Loads config, no profile support
├── errors/             # Effect TaggedEnum errors ✓
├── linear/             # OLD: LinearService class (deprecated)
├── services/           # NEW: Effect layers ✓
│   ├── cache.ts        # CacheService layer
│   ├── config.ts       # ConfigService layer
│   ├── git.ts          # GitService layer
│   ├── linear-client.ts # LinearClientService layer
│   ├── linear.ts       # LinearService layer
│   └── output.ts       # OutputService layer
├── runtime/effect.ts   # CliContext bridge (hacky)
└── utils/              # Standalone utilities
```

### Key Discoveries
1. **Commands use old pattern**: `BaseCommand.buildContext()` creates class-based `LinearService`
2. **Effect partially integrated**: `runCommandEffect()` bridges old context to Effect
3. **No profile support**: Config has single `apiKey`, `defaults` - no named profiles
4. **Cache not org-namespaced**: `~/.cache/linear-sh/metadata-cache.json` shared across orgs
5. **Tests use mock layers**: Good pattern in `git.test.ts`, `linear.test.ts`

### Files to Delete After Migration
- `src/linear/client.ts` (old LinearService class)
- `src/linear/cache.ts` (old MetadataCache class)
- `src/linear/types.ts` (duplicated in services)
- `src/git/branch.ts` (replaced by GitService)
- `src/utils/logger.ts` (replaced by LoggerService)
- `src/utils/output.ts` (replaced by OutputService)

## Desired End State

```
src/
├── commands/
│   ├── base-command.ts     # Effect-native, provides layers
│   ├── issue/              # All Effect-based
│   └── profile/            # NEW: profile add/use/list/remove/show
├── config/
│   ├── schema.ts           # Config types with profiles
│   ├── loader.ts           # Load/merge config
│   └── profile.ts          # Profile management
├── errors/                 # Same
├── services/               # All services
│   ├── index.ts            # Exports + AppLayer composition
│   └── ...                 # Individual services
└── test/
    ├── preload.ts          # Network blocking
    ├── mocks/              # Mock factories
    │   ├── linear.ts
    │   ├── cache.ts
    │   └── git.ts
    └── layers.ts           # Test layer composition
```

### Verification
```bash
bun run check           # typecheck + lint + test
linear-sh profile list  # Shows profiles
linear-sh profile use work && linear-sh issue list  # Works
bun test                # All pass, no network calls
```

## Out of Scope

- OAuth/SSO authentication flows
- Multiple simultaneous orgs in one command
- Syncing profiles across machines
- GraphQL schema introspection
- Plugin system

---

# Phase 1: Linting & TypeScript Strictness

## Overview
Remove Biome, configure oxlint strictly, add oxfmt, tighten tsconfig.

## Prerequisites
- [x] None

## Changes

### 1. Remove Biome
**File**: `package.json`

**Before**:
```json
"devDependencies": {
  "@biomejs/biome": "^1.8.3",
  ...
}
```

**After**:
```json
"devDependencies": {
  ...
}
```

**Also delete**: `biome.json`

### 2. Configure oxlint
**File**: `.oxlintrc.json`

**After** (replace entire file):
```json
{
  "$schema": "https://raw.githubusercontent.com/oxc-project/oxc/main/npm/oxlint/configuration_schema.json",
  "categories": {
    "correctness": "error",
    "suspicious": "error",
    "pedantic": "warn",
    "perf": "warn",
    "style": "off"
  },
  "plugins": ["typescript", "import", "promise"],
  "rules": {
    "typescript/no-explicit-any": "error",
    "typescript/no-unsafe-argument": "error",
    "typescript/no-unsafe-assignment": "error",
    "typescript/no-unsafe-call": "error",
    "typescript/no-unsafe-member-access": "error",
    "typescript/no-unsafe-return": "error",
    "typescript/explicit-function-return-type": "error",
    "typescript/no-floating-promises": "error",
    "typescript/no-misused-promises": "error",
    "typescript/ban-ts-comment": ["error", { "ts-expect-error": "allow-with-description" }],
    "typescript/no-this-alias": "off",
    
    "no-await-in-loop": "warn",
    "prefer-const": "error",
    "no-var": "error",
    "no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    
    "import/no-cycle": "error",
    "import/no-default-export": "off",
    
    "promise/no-floating-promises": "error"
  },
  "ignorePatterns": ["bin/**", "dist/**", "node_modules/**"]
}
```

### 3. Configure oxfmt
**File**: `.oxfmtrc.json` (new)

```json
{
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": true,
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all",
  "bracketSpacing": true
}
```

### 4. Stricter tsconfig
**File**: `tsconfig.json`

**Before**:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    ...
  }
}
```

**After**:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noPropertyAccessFromIndexSignature": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "rootDir": "./src",
    "outDir": "./dist",
    "types": ["bun-types"]
  },
  "include": ["src/**/*.ts"],
  "exclude": ["bin", "dist", "node_modules"]
}
```

### 5. Update package.json scripts
**File**: `package.json`

**Before**:
```json
"scripts": {
  "lint": "oxlint src/",
  "format": "bunx biome format --write .",
  ...
}
```

**After**:
```json
"scripts": {
  "build": "bun build ./src/index.ts --outfile ./bin/linear.mjs --target bun --minify",
  "lint": "oxlint src/",
  "lint:fix": "oxlint src/ --fix",
  "format": "oxfmt --write .",
  "format:check": "oxfmt --check .",
  "test": "bun test",
  "test:unit": "bun test --grep 'unit|accessor|pure'",
  "test:integration": "ALLOW_TEST_NETWORK=1 bun test --grep 'integration'",
  "typecheck": "bunx tsc --noEmit",
  "check": "bun run typecheck && bun run lint && bun run format:check && bun run test:unit"
}
```

### 6. Update .gitignore
**File**: `.gitignore`

**Add**:
```
# Build artifacts
linear-sh
index
*.bun-build
```

## Success Criteria

**Automated**:
```bash
bun run typecheck        # Zero errors
bun run lint             # Zero errors (after fixes)
bun run format:check     # Zero differences
```

**Manual**:
- [x] `biome.json` deleted
- [ ] No `@biomejs/biome` in node_modules after `bun install`

## Rollback
```bash
git checkout HEAD -- package.json tsconfig.json .oxlintrc.json biome.json
```

---

# Phase 2: Config & Profile Schema

## Overview
Design and implement profile-aware configuration schema.

## Prerequisites
- [ ] Phase 1 complete

## Changes

### 1. Profile Schema Types
**File**: `src/config/schema.ts` (new)

```typescript
// Output format for CLI
export type OutputFormat = "plain" | "json";

// Defaults that are org-specific
export interface ProfileDefaults {
  readonly teamId?: string;
  readonly assigneeId?: string;
  readonly workflowStateId?: string;
  readonly projectId?: string;
}

// A single profile configuration
export interface Profile {
  readonly apiKey: string;
  readonly apiHost?: string;
  readonly orgId?: string;           // Cached from viewer.organization.id
  readonly orgName?: string;         // Cached for display
  readonly defaults: ProfileDefaults;
}

// Full config file structure
export interface ConfigFile {
  readonly activeProfile?: string;
  readonly output?: OutputFormat;
  readonly profiles: Record<string, Profile>;
}

// Resolved runtime config (after merging env, files, flags)
export interface ResolvedConfig {
  readonly activeProfile: string;
  readonly profile: Profile;
  readonly output: OutputFormat;
  readonly paths: ConfigPaths;
}

export interface ConfigPaths {
  readonly configDir: string;       // ~/.config/linear-sh
  readonly configFile: string;      // ~/.config/linear-sh/config.json
  readonly cacheDir: string;        // ~/.cache/linear-sh/{orgId}
  readonly activeProfileFile: string; // ~/.config/linear-sh/active-profile
}

// Config file defaults
export const DEFAULT_PROFILE_NAME = "default";
export const DEFAULT_API_HOST = "https://api.linear.app/graphql";
export const DEFAULT_OUTPUT: OutputFormat = "plain";

export const emptyProfile = (): Profile => ({
  apiKey: "",
  apiHost: DEFAULT_API_HOST,
  defaults: {},
});

export const emptyConfigFile = (): ConfigFile => ({
  profiles: {},
});
```

### 2. Config Loader
**File**: `src/config/loader.ts` (new)

```typescript
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { Effect } from "effect";

import { ConfigError, type LinearError } from "../errors";
import {
  type ConfigFile,
  type ConfigPaths,
  type Profile,
  type ResolvedConfig,
  DEFAULT_API_HOST,
  DEFAULT_OUTPUT,
  DEFAULT_PROFILE_NAME,
  emptyConfigFile,
  emptyProfile,
} from "./schema";

// -----------------------------------------------------------------------------
// Path Resolution
// -----------------------------------------------------------------------------

export function getConfigPaths(homeDir = os.homedir()): Omit<ConfigPaths, "cacheDir"> & { baseCacheDir: string } {
  const configDir = path.join(homeDir, ".config", "linear-sh");
  return {
    configDir,
    configFile: path.join(configDir, "config.json"),
    activeProfileFile: path.join(configDir, "active-profile"),
    baseCacheDir: path.join(homeDir, ".cache", "linear-sh"),
  };
}

export function getCacheDir(baseCacheDir: string, orgId?: string): string {
  return orgId ? path.join(baseCacheDir, orgId) : baseCacheDir;
}

// -----------------------------------------------------------------------------
// File Operations
// -----------------------------------------------------------------------------

export function readConfigFile(filePath: string): ConfigFile | undefined {
  if (!existsSync(filePath)) {
    return undefined;
  }
  try {
    const content = readFileSync(filePath, "utf8");
    return JSON.parse(content) as ConfigFile;
  } catch {
    return undefined;
  }
}

export function writeConfigFile(filePath: string, config: ConfigFile): void {
  const dir = path.dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(filePath, JSON.stringify(config, null, 2), "utf8");
}

export function readActiveProfile(filePath: string): string | undefined {
  if (!existsSync(filePath)) {
    return undefined;
  }
  try {
    return readFileSync(filePath, "utf8").trim() || undefined;
  } catch {
    return undefined;
  }
}

export function writeActiveProfile(filePath: string, profileName: string): void {
  const dir = path.dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(filePath, profileName, "utf8");
}

// -----------------------------------------------------------------------------
// Environment Merging
// -----------------------------------------------------------------------------

interface EnvOverrides {
  apiKey?: string;
  apiHost?: string;
  profile?: string;
  output?: "plain" | "json";
  defaults: Partial<Profile["defaults"]>;
}

export function getEnvOverrides(env = process.env): EnvOverrides {
  return {
    apiKey: env.LINEAR_API_KEY,
    apiHost: env.LINEAR_API_HOST ?? env.LINEAR_API_BASE,
    profile: env.LINEAR_PROFILE,
    output: env.LINEAR_OUTPUT_FORMAT === "json" ? "json" : 
            env.LINEAR_OUTPUT_FORMAT === "plain" ? "plain" : undefined,
    defaults: {
      teamId: env.LINEAR_DEFAULT_TEAM_ID ?? env.LINEAR_TEAM_ID,
      assigneeId: env.LINEAR_DEFAULT_ASSIGNEE_ID,
      workflowStateId: env.LINEAR_DEFAULT_WORKFLOW_STATE_ID,
      projectId: env.LINEAR_DEFAULT_PROJECT_ID,
    },
  };
}

// -----------------------------------------------------------------------------
// Config Resolution
// -----------------------------------------------------------------------------

export interface LoadConfigOptions {
  readonly homeDir?: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly profileOverride?: string;
  readonly requireApiKey?: boolean;
}

export function loadConfig(options: LoadConfigOptions = {}): Effect.Effect<ResolvedConfig, LinearError> {
  return Effect.try({
    try: () => loadConfigSync(options),
    catch: (error) => ConfigError(
      error instanceof Error ? error.message : String(error)
    ),
  });
}

export function loadConfigSync(options: LoadConfigOptions = {}): ResolvedConfig {
  const homeDir = options.homeDir ?? os.homedir();
  const env = options.env ?? process.env;
  
  const paths = getConfigPaths(homeDir);
  const envOverrides = getEnvOverrides(env);
  
  // Load config file
  const configFile = readConfigFile(paths.configFile) ?? emptyConfigFile();
  
  // Determine active profile
  const activeProfile = 
    options.profileOverride ??
    envOverrides.profile ??
    readActiveProfile(paths.activeProfileFile) ??
    configFile.activeProfile ??
    DEFAULT_PROFILE_NAME;
  
  // Get profile, creating empty if doesn't exist
  const baseProfile = configFile.profiles[activeProfile] ?? emptyProfile();
  
  // Merge env overrides into profile
  const profile: Profile = {
    apiKey: envOverrides.apiKey ?? baseProfile.apiKey,
    apiHost: envOverrides.apiHost ?? baseProfile.apiHost ?? DEFAULT_API_HOST,
    orgId: baseProfile.orgId,
    orgName: baseProfile.orgName,
    defaults: {
      ...baseProfile.defaults,
      ...Object.fromEntries(
        Object.entries(envOverrides.defaults).filter(([, v]) => v !== undefined)
      ),
    },
  };
  
  // Validate
  if (options.requireApiKey !== false && !profile.apiKey) {
    throw new Error(
      "Linear API key is required. Set LINEAR_API_KEY or configure a profile."
    );
  }
  
  const cacheDir = getCacheDir(paths.baseCacheDir, profile.orgId);
  
  return {
    activeProfile,
    profile,
    output: envOverrides.output ?? configFile.output ?? DEFAULT_OUTPUT,
    paths: {
      configDir: paths.configDir,
      configFile: paths.configFile,
      cacheDir,
      activeProfileFile: paths.activeProfileFile,
    },
  };
}
```

### 3. Profile Manager
**File**: `src/config/profile.ts` (new)

```typescript
import { Effect } from "effect";
import { LinearClient } from "@linear/sdk";

import { ConfigError, LinearApiError, type LinearError } from "../errors";
import {
  type ConfigFile,
  type Profile,
  type ProfileDefaults,
  DEFAULT_API_HOST,
  emptyConfigFile,
} from "./schema";
import {
  getConfigPaths,
  getCacheDir,
  readConfigFile,
  writeConfigFile,
  readActiveProfile,
  writeActiveProfile,
} from "./loader";

// -----------------------------------------------------------------------------
// Profile Operations
// -----------------------------------------------------------------------------

export interface ProfileSummary {
  readonly name: string;
  readonly orgName?: string;
  readonly orgId?: string;
  readonly isActive: boolean;
  readonly hasApiKey: boolean;
}

export function listProfiles(homeDir?: string): ProfileSummary[] {
  const paths = getConfigPaths(homeDir);
  const config = readConfigFile(paths.configFile) ?? emptyConfigFile();
  const active = readActiveProfile(paths.activeProfileFile) ?? config.activeProfile ?? "default";
  
  return Object.entries(config.profiles).map(([name, profile]) => ({
    name,
    orgName: profile.orgName,
    orgId: profile.orgId,
    isActive: name === active,
    hasApiKey: Boolean(profile.apiKey),
  }));
}

export function getProfile(name: string, homeDir?: string): Profile | undefined {
  const paths = getConfigPaths(homeDir);
  const config = readConfigFile(paths.configFile) ?? emptyConfigFile();
  return config.profiles[name];
}

export function setActiveProfile(name: string, homeDir?: string): Effect.Effect<void, LinearError> {
  return Effect.try({
    try: () => {
      const paths = getConfigPaths(homeDir);
      const config = readConfigFile(paths.configFile) ?? emptyConfigFile();
      
      if (!config.profiles[name]) {
        throw new Error(`Profile "${name}" does not exist`);
      }
      
      writeActiveProfile(paths.activeProfileFile, name);
    },
    catch: (error) => ConfigError(
      error instanceof Error ? error.message : String(error)
    ),
  });
}

export interface AddProfileOptions {
  readonly name: string;
  readonly apiKey: string;
  readonly apiHost?: string;
  readonly defaults?: ProfileDefaults;
  readonly setActive?: boolean;
}

export function addProfile(options: AddProfileOptions, homeDir?: string): Effect.Effect<Profile, LinearError> {
  return Effect.gen(function* () {
    const paths = getConfigPaths(homeDir);
    const config = readConfigFile(paths.configFile) ?? emptyConfigFile();
    
    // Fetch org info from API
    const orgInfo = yield* fetchOrgInfo(options.apiKey, options.apiHost);
    
    const profile: Profile = {
      apiKey: options.apiKey,
      apiHost: options.apiHost ?? DEFAULT_API_HOST,
      orgId: orgInfo.id,
      orgName: orgInfo.name,
      defaults: options.defaults ?? {},
    };
    
    config.profiles[options.name] = profile;
    
    yield* Effect.try({
      try: () => writeConfigFile(paths.configFile, config),
      catch: (error) => ConfigError(`Failed to write config: ${String(error)}`),
    });
    
    if (options.setActive) {
      yield* setActiveProfile(options.name, homeDir);
    }
    
    return profile;
  });
}

export function removeProfile(name: string, homeDir?: string): Effect.Effect<void, LinearError> {
  return Effect.try({
    try: () => {
      const paths = getConfigPaths(homeDir);
      const config = readConfigFile(paths.configFile) ?? emptyConfigFile();
      
      if (!config.profiles[name]) {
        throw new Error(`Profile "${name}" does not exist`);
      }
      
      const active = readActiveProfile(paths.activeProfileFile) ?? config.activeProfile;
      if (active === name) {
        throw new Error(`Cannot remove active profile "${name}". Switch to another profile first.`);
      }
      
      delete config.profiles[name];
      writeConfigFile(paths.configFile, config);
      
      // Optionally: clean up cache for this profile's orgId
    },
    catch: (error) => ConfigError(
      error instanceof Error ? error.message : String(error)
    ),
  });
}

// -----------------------------------------------------------------------------
// API Helpers
// -----------------------------------------------------------------------------

interface OrgInfo {
  readonly id: string;
  readonly name: string;
}

function fetchOrgInfo(apiKey: string, apiHost?: string): Effect.Effect<OrgInfo, LinearError> {
  return Effect.tryPromise({
    try: async () => {
      const client = new LinearClient({
        apiKey,
        apiUrl: apiHost ?? DEFAULT_API_HOST,
      });
      
      const viewer = await client.viewer;
      const org = await viewer.organization;
      
      if (!org) {
        throw new Error("Could not fetch organization info");
      }
      
      return {
        id: org.id,
        name: org.name,
      };
    },
    catch: (error) => LinearApiError(
      `Failed to fetch organization: ${error instanceof Error ? error.message : String(error)}`,
      undefined,
      "fetchOrgInfo"
    ),
  });
}
```

### 4. Export Index
**File**: `src/config/index.ts` (new)

```typescript
export {
  type ConfigFile,
  type ConfigPaths,
  type OutputFormat,
  type Profile,
  type ProfileDefaults,
  type ResolvedConfig,
  DEFAULT_API_HOST,
  DEFAULT_OUTPUT,
  DEFAULT_PROFILE_NAME,
  emptyConfigFile,
  emptyProfile,
} from "./schema";

export {
  type LoadConfigOptions,
  getConfigPaths,
  getCacheDir,
  loadConfig,
  loadConfigSync,
  readConfigFile,
  writeConfigFile,
} from "./loader";

export {
  type AddProfileOptions,
  type ProfileSummary,
  addProfile,
  getProfile,
  listProfiles,
  removeProfile,
  setActiveProfile,
} from "./profile";
```

## Success Criteria

**Automated**:
```bash
bun run typecheck        # Zero errors
bun test src/config/     # Tests pass (write in Phase 5)
```

**Manual**:
- [ ] Can create `~/.config/linear-sh/config.json` with profile structure
- [ ] `loadConfigSync()` resolves profile from env/file

## Rollback
```bash
rm -rf src/config/
git checkout HEAD -- src/config.ts
```

---

# Phase 3: Update Services for Profiles

## Overview
Update ConfigService and CacheService to use profile-aware config.

## Prerequisites
- [ ] Phase 2 complete

## Changes

### 1. Update ConfigService
**File**: `src/services/config.ts`

**Before** (key parts):
```typescript
import { loadLinearConfig } from "../config";
// ...
export interface ConfigService {
  readonly get: () => Effect.Effect<LinearConfig, LinearError>;
  readonly getDefaults: () => Effect.Effect<LinearConfigDefaults, LinearError>;
  readonly getApiKey: () => Effect.Effect<string, LinearError>;
}
```

**After** (full replacement):
```typescript
import { Context, Effect, Layer } from "effect";

import {
  type LoadConfigOptions,
  type Profile,
  type ProfileDefaults,
  type ResolvedConfig,
  loadConfig,
} from "../config";
import { ConfigError, type LinearError } from "../errors";

// -----------------------------------------------------------------------------
// Service Interface
// -----------------------------------------------------------------------------

export interface ConfigService {
  /** Get the full resolved configuration */
  readonly getConfig: () => Effect.Effect<ResolvedConfig, LinearError>;

  /** Get the active profile */
  readonly getProfile: () => Effect.Effect<Profile, LinearError>;

  /** Get just the defaults section */
  readonly getDefaults: () => Effect.Effect<ProfileDefaults, LinearError>;

  /** Get the API key, failing if not present */
  readonly getApiKey: () => Effect.Effect<string, LinearError>;

  /** Get cache directory (org-namespaced) */
  readonly getCacheDir: () => Effect.Effect<string, LinearError>;

  /** Get active profile name */
  readonly getActiveProfileName: () => Effect.Effect<string, LinearError>;
}

// -----------------------------------------------------------------------------
// Context Tag
// -----------------------------------------------------------------------------

export const ConfigService = Context.GenericTag<ConfigService>(
  "linear-sh/services/ConfigService",
);

// -----------------------------------------------------------------------------
// Live Implementation
// -----------------------------------------------------------------------------

export const makeConfigServiceLive = (
  options: LoadConfigOptions = {},
): Layer.Layer<ConfigService, LinearError> =>
  Layer.effect(
    ConfigService,
    loadConfig(options).pipe(
      Effect.map((config) =>
        ConfigService.of({
          getConfig: () => Effect.succeed(config),

          getProfile: () => Effect.succeed(config.profile),

          getDefaults: () => Effect.succeed(config.profile.defaults),

          getApiKey: () =>
            config.profile.apiKey
              ? Effect.succeed(config.profile.apiKey)
              : Effect.fail(
                  ConfigError(
                    "Linear API key is required. Set LINEAR_API_KEY or configure a profile.",
                  ),
                ),

          getCacheDir: () => Effect.succeed(config.paths.cacheDir),

          getActiveProfileName: () => Effect.succeed(config.activeProfile),
        }),
      ),
    ),
  );

export const ConfigServiceLive: Layer.Layer<ConfigService, LinearError> =
  makeConfigServiceLive({ requireApiKey: false });

// -----------------------------------------------------------------------------
// Accessor functions
// -----------------------------------------------------------------------------

export const getConfig = (): Effect.Effect<ResolvedConfig, LinearError, ConfigService> =>
  Effect.flatMap(ConfigService, (service) => service.getConfig());

export const getProfile = (): Effect.Effect<Profile, LinearError, ConfigService> =>
  Effect.flatMap(ConfigService, (service) => service.getProfile());

export const getDefaults = (): Effect.Effect<ProfileDefaults, LinearError, ConfigService> =>
  Effect.flatMap(ConfigService, (service) => service.getDefaults());

export const getApiKey = (): Effect.Effect<string, LinearError, ConfigService> =>
  Effect.flatMap(ConfigService, (service) => service.getApiKey());

export const getCacheDir = (): Effect.Effect<string, LinearError, ConfigService> =>
  Effect.flatMap(ConfigService, (service) => service.getCacheDir());

export const getActiveProfileName = (): Effect.Effect<string, LinearError, ConfigService> =>
  Effect.flatMap(ConfigService, (service) => service.getActiveProfileName());
```

### 2. Update CacheService for org-namespacing
**File**: `src/services/cache.ts`

**Key change**: Use `getCacheDir()` from ConfigService instead of hardcoded path.

The `makeCacheServiceLive` already depends on ConfigService. Update it to use `getCacheDir`:

```typescript
// In makeCacheServiceLive, replace:
const cacheDir = path.join(homeDir, ".cache", "linear-sh");

// With:
const cacheDir = yield* configService.getCacheDir();
```

### 3. Update services/index.ts exports
**File**: `src/services/index.ts`

**Add** to ConfigService exports:
```typescript
export {
  ConfigService,
  ConfigServiceLive,
  makeConfigServiceLive,
  getConfig,
  getProfile,
  getDefaults,
  getApiKey,
  getCacheDir,
  getActiveProfileName,
} from "./config";
```

## Success Criteria

**Automated**:
```bash
bun run typecheck        # Zero errors
bun test src/services/   # Tests pass
```

**Manual**:
- [ ] ConfigService resolves profile from config file
- [ ] Cache files written to org-namespaced directory

---

# Phase 4: Effect-Native BaseCommand

## Overview
Rewrite BaseCommand to provide Effect layers instead of class instances.

## Prerequisites
- [ ] Phase 3 complete

## Changes

### 1. New CliRuntime module
**File**: `src/runtime/cli.ts` (new, replaces effect.ts)

```typescript
import { Effect, Layer } from "effect";

import { toError } from "../errors";
import {
  CacheService,
  CacheServiceLive,
  ConfigService,
  makeConfigServiceLive,
  GitService,
  GitServiceLive,
  LinearClientService,
  LinearClientLive,
  LinearService,
  LinearServiceLive,
  LoggerService,
  LoggerServiceLive,
  OutputService,
  makeOutputServiceLive,
  type OutputServiceOptions,
} from "../services";

// -----------------------------------------------------------------------------
// App Layer Composition
// -----------------------------------------------------------------------------

export interface AppLayerOptions {
  readonly profileOverride?: string;
  readonly outputFormat?: "plain" | "json";
  readonly noCache?: boolean;
  readonly requireApiKey?: boolean;
}

export type AppServices = 
  | ConfigService 
  | CacheService 
  | LinearClientService 
  | LinearService 
  | GitService 
  | LoggerService 
  | OutputService;

export function makeAppLayer(
  options: AppLayerOptions = {},
): Layer.Layer<AppServices, LinearError> {
  const configLayer = makeConfigServiceLive({
    profileOverride: options.profileOverride,
    requireApiKey: options.requireApiKey,
  });

  const cacheLayer = options.noCache
    ? Layer.succeed(CacheService, {
        get: () => Effect.succeed(undefined),
        set: () => Effect.void,
        invalidate: () => Effect.void,
        clear: () => Effect.void,
      })
    : CacheServiceLive;

  const outputOptions: OutputServiceOptions = {
    format: options.outputFormat,
  };
  const outputLayer = makeOutputServiceLive(outputOptions);

  // Build layer graph
  return Layer.mergeAll(
    configLayer,
    GitServiceLive,
    LoggerServiceLive,
    outputLayer,
  ).pipe(
    Layer.provideMerge(cacheLayer),
    Layer.provideMerge(LinearClientLive),
    Layer.provideMerge(LinearServiceLive),
  );
}

// -----------------------------------------------------------------------------
// Command Runner
// -----------------------------------------------------------------------------

export interface RunOptions extends AppLayerOptions {
  readonly onError?: (error: Error) => void;
}

export async function runCommand<E, A>(
  program: Effect.Effect<A, E, AppServices>,
  options: RunOptions = {},
): Promise<A> {
  const layer = makeAppLayer(options);
  
  const runnable = Effect.provide(program, layer);
  
  const exit = await Effect.runPromiseExit(runnable);
  
  return Effect.Exit.match(exit, {
    onSuccess: (value) => value,
    onFailure: (cause) => {
      const error = toError(Effect.Cause.squash(cause));
      if (options.onError) {
        options.onError(error);
      }
      throw error;
    },
  });
}

export function runCommandExit<E>(
  program: Effect.Effect<number, E, AppServices>,
  options: RunOptions = {},
): Promise<number> {
  return runCommand(program, options).catch(() => 1);
}
```

### 2. Rewrite BaseCommand
**File**: `src/commands/base-command.ts`

**After** (full replacement):
```typescript
import { Command, Option } from "clipanion";
import { Effect } from "effect";

import {
  type AppServices,
  type AppLayerOptions,
  runCommandExit,
} from "../runtime/cli";

export abstract class BaseCommand extends Command {
  json = Option.Boolean("--json", false, {
    description: "Emit machine-readable JSON output",
  });

  noCache = Option.Boolean("--no-cache", false, {
    description: "Disable metadata caching for this invocation",
  });

  profile = Option.String("--profile", {
    description: "Use a specific profile",
    required: false,
  });

  /**
   * Build layer options from command flags.
   */
  protected getLayerOptions(): AppLayerOptions {
    return {
      profileOverride: this.profile,
      outputFormat: this.json ? "json" : undefined,
      noCache: this.noCache,
      requireApiKey: true,
    };
  }

  /**
   * Run an Effect program with full app layer.
   */
  protected run<E>(
    program: Effect.Effect<number, E, AppServices>,
    options?: Partial<AppLayerOptions>,
  ): Promise<number> {
    const layerOptions = { ...this.getLayerOptions(), ...options };
    
    return runCommandExit(program, {
      ...layerOptions,
      onError: (error) => this.reportError(error),
    });
  }

  /**
   * Report an error to output.
   */
  private reportError(error: Error): void {
    const message = error.message;
    const code = "code" in error ? String(error.code) : "ERROR";
    
    if (this.json) {
      console.error(JSON.stringify({ error: { message, code } }));
    } else {
      console.error(`Error: ${message}`);
    }
  }
}
```

### 3. Delete old runtime/effect.ts
**File**: `src/runtime/effect.ts`

**Delete** this file after migration.

## Success Criteria

**Automated**:
```bash
bun run typecheck        # Zero errors
```

**Manual**:
- [ ] Commands can extend BaseCommand and use `this.run(program)`
- [ ] Layers compose correctly

---

# Phase 5: Command Migration

## Overview
Migrate all issue commands to pure Effect.

## Prerequisites
- [ ] Phase 4 complete

## Changes

Each command follows this pattern:

**Before** (example: view):
```typescript
async execute(): Promise<number> {
  return this.withContext(async (context) => {
    const program = Effect.gen(function* () {
      const ctx = yield* CliContext;
      // ... uses ctx.service (old pattern)
    });
    return runCommandEffect(context, program);
  });
}
```

**After**:
```typescript
async execute(): Promise<number> {
  return this.run(
    Effect.gen(function* () {
      const linearService = yield* LinearService;
      const outputService = yield* OutputService;
      // ... uses Effect services directly
    })
  );
}
```

### Commands to Migrate (in order)

1. **IssueIdCommand** (`src/commands/issue/id.ts`) - simplest
2. **IssueTitleCommand** (`src/commands/issue/title.ts`)
3. **IssueUrlCommand** (`src/commands/issue/url.ts`)
4. **IssueViewCommand** (`src/commands/issue/view.ts`)
5. **IssueListCommand** (`src/commands/issue/list.ts`)
6. **IssueCreateCommand** (`src/commands/issue/create.ts`)
7. **IssueUpdateCommand** (`src/commands/issue/update.ts`)
8. **IssueStartCommand** (`src/commands/issue/start.ts`)
9. **IssuePrCommand** (`src/commands/issue/pr.ts`)
10. **RootCommand** (`src/index.ts`)

### Update IssueBaseCommand

**File**: `src/commands/issue/base.ts`

```typescript
import { Option } from "clipanion";
import { Effect } from "effect";

import { GitService, inferIssueKey } from "../../services";
import { ValidationError } from "../../errors";
import { BaseCommand } from "../base-command";

export const ISSUE_USAGE_CATEGORY = "Issue workflows";

export abstract class IssueBaseCommand extends BaseCommand {
  issueRef = Option.String({ required: false });

  protected resolveIssueRefEffect(fallbackToGit = true) {
    const ref = this.issueRef;
    
    return Effect.gen(function* () {
      if (ref) {
        return ref;
      }
      
      if (!fallbackToGit) {
        return yield* Effect.fail(
          ValidationError("Issue reference is required", "issueRef")
        );
      }
      
      const inferred = yield* inferIssueKey();
      
      if (!inferred) {
        return yield* Effect.fail(
          ValidationError(
            "Issue reference not provided and could not infer from Git branch",
            "issueRef"
          )
        );
      }
      
      return inferred;
    });
  }
}
```

## Success Criteria

**Automated**:
```bash
bun run typecheck        # Zero errors
bun test                 # All pass
linear-sh issue view     # Works
linear-sh issue list     # Works
```

---

# Phase 6: Profile Commands

## Overview
Add CLI commands for profile management.

## Prerequisites
- [ ] Phase 5 complete (at least BaseCommand)

## Changes

### 1. Profile List Command
**File**: `src/commands/profile/list.ts` (new)

### 2. Profile Add Command
**File**: `src/commands/profile/add.ts` (new)

### 3. Profile Use Command
**File**: `src/commands/profile/use.ts` (new)

### 4. Profile Remove Command
**File**: `src/commands/profile/remove.ts` (new)

### 5. Profile Show Command
**File**: `src/commands/profile/show.ts` (new)

### 6. Register Commands
**File**: `src/index.ts`

## Success Criteria

**Automated**:
```bash
bun run typecheck
linear-sh profile list --json  # Works
```

**Manual**:
- [ ] `linear-sh profile add --name test --api-key xxx` creates profile
- [ ] `linear-sh profile use test` switches profile
- [ ] `linear-sh profile show` displays config
- [ ] `linear-sh profile remove test` removes profile

---

# Phase 7: Discovery Commands

## Overview
Add team list, state list, user list commands.

## Prerequisites
- [ ] Phase 5 complete

## Changes

### 1. Team List Command
**File**: `src/commands/team/list.ts` (new)

### 2. State List Command
**File**: `src/commands/state/list.ts` (new)

### 3. User List Command
**File**: `src/commands/user/list.ts` (new)

### 4. Register Commands in `src/index.ts`

## Success Criteria

```bash
linear-sh team list          # Works
linear-sh state list         # Works
linear-sh user list          # Works
linear-sh team list --json   # JSON output
```

---

# Phase 8: Test Infrastructure

## Overview
Build comprehensive test infrastructure with mocks and layers.

## Prerequisites
- [ ] Phase 5 complete

## Changes

### 1. Mock Factories
**File**: `src/test/mocks/linear.ts` (new)

### 2. Mock Cache
**File**: `src/test/mocks/cache.ts` (new)

### 3. Test Layers
**File**: `src/test/layers.ts` (new)

### 4. Update test/preload.ts

## Success Criteria

```bash
bun test                        # All pass
bun test:unit                   # Unit tests only
ALLOW_TEST_NETWORK=1 bun test   # Integration tests (manual)
```

---

# Phase 9: Cleanup & Documentation

## Overview
Delete old files, update docs.

## Prerequisites
- [ ] All previous phases complete
- [ ] All tests passing

## Changes

### 1. Delete Old Files

```bash
rm src/config.ts                    # Replaced by src/config/
rm src/config.test.ts               # Migrate tests first
rm src/linear/client.ts             # Replaced by services/linear.ts
rm src/linear/client.test.ts        # Migrate tests first
rm src/linear/cache.ts              # Replaced by services/cache.ts
rm src/linear/cache.test.ts         # Migrate tests first
rm src/linear/types.ts              # Duplicated in services
rm src/git/branch.ts                # Replaced by services/git.ts
rm src/git/branch.test.ts           # Already migrated
rm src/utils/logger.ts              # Replaced by services/logger.ts
rm src/utils/output.ts              # Replaced by services/output.ts
rm src/utils/output.test.ts         # Migrate tests first
rm src/runtime/effect.ts            # Replaced by runtime/cli.ts
rm src/commands/issue/helpers.ts    # Inlined into commands or services
rmdir src/linear/                   # After removing files
rmdir src/git/                      # After removing files
```

### 2. Update AGENTS.md

Update architecture section to reflect new structure.

### 3. Update README.md

Add profile usage examples.

## Success Criteria

```bash
bun run check                # All pass
fd -e ts . src --type f      # No old files
```

---

# Testing Strategy

## Unit Tests

Each service has corresponding `.test.ts` with:
- Mock layer injection
- All public methods tested
- Error cases tested

## Integration Tests

Mark with `describe.skip` by default, run with `ALLOW_TEST_NETWORK=1`:
- Real API calls to sandbox org
- Profile switching
- Cache behavior

## Manual Testing Checklist

1. [ ] Fresh install: `rm -rf ~/.config/linear-sh ~/.cache/linear-sh`
2. [ ] `linear-sh` shows "no API key" message
3. [ ] `linear-sh profile add` creates profile interactively
4. [ ] `linear-sh issue list` works with new profile
5. [ ] `linear-sh profile add --name work` adds second profile
6. [ ] `linear-sh profile use work` switches
7. [ ] Cache isolated per org

---

# Anti-Patterns to Avoid

1. **Don't mix old/new patterns** - Once a file is migrated, don't import from old locations
2. **Don't use `context.service`** - Use Effect accessors
3. **Don't hardcode paths** - Use ConfigService.getCacheDir()
4. **Don't swallow errors** - Let Effect propagate, handle at command level

---

# Open Questions

- [x] oxfmt config format? → JSON with .oxfmtrc.json
- [x] Keep biome for anything? → No, full switch to ox* tools
- [ ] Profile storage format versioning? → Future consideration
- [ ] Migration path for existing users? → Detect old config, auto-migrate

---

# References

- Existing issues: `bd list --status open`
- Effect docs: https://effect.website
- oxlint rules: `npx oxlint --rules`
- Linear SDK: https://developers.linear.app/docs/sdk

