import type { CommandContext } from "../base-command";

export async function resolveStateId(
	context: CommandContext,
	input: string | undefined,
	teamId?: string,
): Promise<string | undefined> {
	if (!input) {
		return undefined;
	}

	if (typeof input !== "string") {
		return input;
	}

	const states = await context.service.getWorkflowStates(teamId);
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
}

export async function resolveAssigneeId(
	context: CommandContext,
	input: string | undefined,
	teamId?: string,
): Promise<string | undefined> {
	if (!input) {
		return undefined;
	}

	if (typeof input !== "string") {
		return input;
	}

	const users = await context.service.getUsers(teamId);
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
}

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
