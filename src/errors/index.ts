import { Data } from "effect";

// -----------------------------------------------------------------------------
// Tagged Error Union using Effect Data.TaggedEnum
// -----------------------------------------------------------------------------

export type LinearError = Data.TaggedEnum<{
	ConfigError: { readonly message: string; readonly path?: string };
	LinearApiError: {
		readonly message: string;
		readonly status?: number;
		readonly operation?: string;
	};
	CacheError: { readonly message: string; readonly path?: string };
	GitError: { readonly message: string; readonly operation?: string };
	ValidationError: {
		readonly message: string;
		readonly field?: string;
		readonly value?: unknown;
	};
	ResolverError: {
		readonly message: string;
		readonly resolverType: string;
		readonly input?: string;
	};
}>;

export const LinearError = Data.taggedEnum<LinearError>();

// Type aliases for individual error types
export type ConfigError = Data.TaggedEnum.Value<LinearError, "ConfigError">;
export type LinearApiError = Data.TaggedEnum.Value<LinearError, "LinearApiError">;
export type CacheError = Data.TaggedEnum.Value<LinearError, "CacheError">;
export type GitError = Data.TaggedEnum.Value<LinearError, "GitError">;
export type ValidationError = Data.TaggedEnum.Value<LinearError, "ValidationError">;
export type ResolverError = Data.TaggedEnum.Value<LinearError, "ResolverError">;

// -----------------------------------------------------------------------------
// Constructors - convenient factory functions
// -----------------------------------------------------------------------------

export const ConfigError = (message: string, path?: string): LinearError =>
	LinearError.ConfigError({ message, path });

export const LinearApiError = (message: string, status?: number, operation?: string): LinearError =>
	LinearError.LinearApiError({ message, status, operation });

export const CacheError = (message: string, path?: string): LinearError =>
	LinearError.CacheError({ message, path });

export const GitError = (message: string, operation?: string): LinearError =>
	LinearError.GitError({ message, operation });

export const ValidationError = (message: string, field?: string, value?: unknown): LinearError =>
	LinearError.ValidationError({ message, field, value });

export const ResolverError = (message: string, resolverType: string, input?: string): LinearError =>
	LinearError.ResolverError({ message, resolverType, input });

// -----------------------------------------------------------------------------
// Type guards
// -----------------------------------------------------------------------------

export const isConfigError = (e: LinearError): e is ConfigError => e._tag === "ConfigError";

export const isLinearApiError = (e: LinearError): e is LinearApiError =>
	e._tag === "LinearApiError";

export const isCacheError = (e: LinearError): e is CacheError => e._tag === "CacheError";

export const isGitError = (e: LinearError): e is GitError => e._tag === "GitError";

export const isValidationError = (e: LinearError): e is ValidationError =>
	e._tag === "ValidationError";

export const isResolverError = (e: LinearError): e is ResolverError => e._tag === "ResolverError";

// -----------------------------------------------------------------------------
// Utilities
// -----------------------------------------------------------------------------

/** Convert LinearError _tag to legacy error code */
export const toErrorCode = (error: LinearError): string => {
	switch (error._tag) {
		case "ConfigError":
			return "CONFIG_ERROR";
		case "LinearApiError":
			return "LINEAR_API_ERROR";
		case "CacheError":
			return "CACHE_ERROR";
		case "GitError":
			return "GIT_ERROR";
		case "ValidationError":
			return "VALIDATION_ERROR";
		case "ResolverError":
			return "RESOLVER_ERROR";
	}
};

/** Convert LinearError to Error for interop with non-Effect code */
export const toError = (error: LinearError): Error => {
	const err = new Error(error.message);
	err.name = error._tag;
	return err;
};

// -----------------------------------------------------------------------------
// Legacy class-based errors for backward compatibility during migration
// Deprecated: prefer tagged errors above
// -----------------------------------------------------------------------------

/** @deprecated Use LinearError tagged union instead */
export class LinearCliError extends Error {
	readonly code: string;

	constructor(message: string, code = "LINEAR_ERROR") {
		super(message);
		this.name = "LinearCliError";
		this.code = code;
	}
}

/** @deprecated Use ConfigError() constructor instead */
export class ConfigErrorClass extends LinearCliError {
	constructor(message: string) {
		super(message, "CONFIG_ERROR");
		this.name = "ConfigError";
	}
}

/** @deprecated Use LinearApiError() constructor instead */
export class LinearApiErrorClass extends LinearCliError {
	readonly status?: number;

	constructor(message: string, status?: number) {
		super(message, "LINEAR_API_ERROR");
		this.name = "LinearApiError";
		this.status = status;
	}
}

/** @deprecated Use CacheError() constructor instead */
export class CacheErrorClass extends LinearCliError {
	constructor(message: string) {
		super(message, "CACHE_ERROR");
		this.name = "CacheError";
	}
}

/** @deprecated Use GitError() constructor instead */
export class GitIntegrationError extends LinearCliError {
	constructor(message: string) {
		super(message, "GIT_ERROR");
		this.name = "GitIntegrationError";
	}
}
