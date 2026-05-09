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
	sanitizeBranchName,
} from "./git";

// Output Service
export {
	OutputService,
	OutputServiceLive,
	makeOutputServiceLive,
	type OutputServiceOptions,
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

// Linear Client Service
export {
	LinearClientService,
	LinearClientLive,
	getIssue,
	getIssueDetails,
	listIssues,
	createIssue,
	updateIssue,
	transitionIssue,
	createComment,
	getWorkflowStates,
	getUsers,
	getTeams,
	getLabels,
	type IssueSummary,
	type IssueDetails,
	type IssueCreateInput,
	type IssueUpdateInput,
	type IssueListOptions,
	type IssueLabelSummary,
	type CommentInput,
	type WorkflowStateSummary,
	type UserSummary,
	type TeamSummary,
} from "./linear-client";

// Re-export types
export type { OutputFormat, Profile, ProfileDefaults, ResolvedConfig } from "../config/index";
