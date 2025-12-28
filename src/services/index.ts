// Config Service
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

// Cache Service
export {
	CacheService,
	CacheServiceLive,
	cacheGet,
	cacheSet,
	cacheInvalidate,
	cacheClear,
} from "./cache";

// Git Service
export {
	GitService,
	GitServiceLive,
	getCurrentBranch,
	createBranch,
	checkoutBranch,
	branchExists,
	inferIssueKey,
} from "./git";

// Output Service
export {
	OutputService,
	OutputServiceLive,
	makeOutputServiceLive,
	write,
	success,
	info,
	warn,
	outputError,
	getFormat,
} from "./output";

// Logger Service
export {
	LoggerService,
	LoggerServiceLive,
	LoggerServiceSilent,
	makeLoggerServiceLive,
	logDebug,
	logInfo,
	logWarn,
	logError,
} from "./logger";

// Re-export types
export type { OutputFormat, Profile, ProfileDefaults, ResolvedConfig } from "../config/index";
