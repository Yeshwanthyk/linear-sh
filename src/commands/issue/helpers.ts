import { Effect } from "effect";

import type { LinearError } from "../../errors";
import { getWorkflowStates, getUsers, type LinearClientService } from "../../services";

// -----------------------------------------------------------------------------
// Effect-based resolvers
// -----------------------------------------------------------------------------

export function resolveStateIdEffect(
	input: string | undefined,
	teamId?: string,
): Effect.Effect<string | undefined, LinearError, LinearClientService> {
	if (!input) {
		return Effect.succeed(undefined);
	}

	return Effect.gen(function* () {
		const states = yield* getWorkflowStates(teamId);
		const direct = states.find((state) => state.id === input);
		if (direct) {
			return direct.id;
		}

		const normalised = input.toLowerCase();
		const byName = states.find((state) => state.name.toLowerCase() === normalised);
		if (byName) {
			return byName.id;
		}

		return input;
	});
}

export function resolveAssigneeIdEffect(
	input: string | undefined,
	_teamId?: string,
): Effect.Effect<string | undefined, LinearError, LinearClientService> {
	if (!input) {
		return Effect.succeed(undefined);
	}

	return Effect.gen(function* () {
		// Note: teamId filtering for users is not directly supported by Linear SDK
		const users = yield* getUsers();
		const direct = users.find((user) => user.id === input);
		if (direct) {
			return direct.id;
		}

		const target = input.toLowerCase();
		const match = users.find((user) =>
			[user.name, user.email].some((value) => value?.toLowerCase() === target),
		);
		if (match) {
			return match.id;
		}

		return input;
	});
}

// -----------------------------------------------------------------------------
// Utility functions
// -----------------------------------------------------------------------------

export function normalizeOptionString(value: unknown): string | undefined {
	if (typeof value !== "string") {
		return undefined;
	}

	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}

export function normalizeOptionStringArray(value: unknown): string[] | undefined {
	if (!Array.isArray(value)) {
		return undefined;
	}

	const values = value.filter(
		(entry): entry is string => typeof entry === "string" && entry.length > 0,
	);
	return values.length > 0 ? values : undefined;
}
