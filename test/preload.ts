const originalFetch = globalThis.fetch?.bind(globalThis);

globalThis.fetch = (async (...args: Parameters<typeof fetch>) => {
	if (process.env.ALLOW_TEST_NETWORK === "1") {
		if (!originalFetch) {
			throw new Error("fetch is not available in this environment");
		}
		return originalFetch(...args);
	}

	const target = typeof args[0] === "string" ? args[0] : args[0].toString();
	throw new Error(`Network access blocked during tests (attempted to fetch ${target})`);
}) as typeof fetch;
