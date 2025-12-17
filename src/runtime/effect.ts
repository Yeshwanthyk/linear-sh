import { Cause, Context, Effect, Exit } from "effect";

import type { CommandContext } from "../commands/base-command";
import { LinearCliError } from "../errors";

export const CliContext = Context.GenericTag<CommandContext>(
	"linear-sh/runtime/CliContext",
);

export function runCommandEffect<R extends typeof CliContext | CommandContext>(
	context: CommandContext,
	program: Effect.Effect<number, unknown, R>,
): Promise<number> {
	const provided = Effect.provideService(
		program,
		CliContext,
		context,
	) as Effect.Effect<number, unknown, never>;
	return Effect.runPromiseExit(provided).then((exit) =>
		Exit.match(exit, {
			onSuccess: (value) => value,
			onFailure: (cause) => {
				const failure = toError(cause);
				const meta =
					failure instanceof LinearCliError
						? { code: failure.code }
						: undefined;
				context.output.error(failure, meta);
				return 1;
			},
		}),
	);
}

function toError(cause: Cause.Cause<unknown>): Error {
	const squashed = Cause.squashWith(cause, (error) =>
		error instanceof Error ? error : new Error(String(error)),
	);
	if (squashed instanceof Error) {
		return squashed;
	}
	if (typeof squashed === "string") {
		return new Error(squashed);
	}
	return new Error(String(squashed));
}
