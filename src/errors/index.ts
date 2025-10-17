export class LinearCliError extends Error {
	readonly code: string;

	constructor(message: string, code = "LINEAR_ERROR") {
		super(message);
		this.name = "LinearCliError";
		this.code = code;
	}
}

export class ConfigError extends LinearCliError {
	constructor(message: string) {
		super(message, "CONFIG_ERROR");
		this.name = "ConfigError";
	}
}

export class LinearApiError extends LinearCliError {
	readonly status?: number;

	constructor(message: string, status?: number) {
		super(message, "LINEAR_API_ERROR");
		this.name = "LinearApiError";
		this.status = status;
	}
}

export class CacheError extends LinearCliError {
	constructor(message: string) {
		super(message, "CACHE_ERROR");
		this.name = "CacheError";
	}
}

export class GitIntegrationError extends LinearCliError {
	constructor(message: string) {
		super(message, "GIT_ERROR");
		this.name = "GitIntegrationError";
	}
}
