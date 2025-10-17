import { Command } from "clipanion";

interface CommandDefinition {
	readonly path: string;
	readonly usage: string;
	readonly category?: string;
	readonly description?: string;
	readonly details?: string;
	readonly examples?: Array<[string, string]>;
	readonly options?: Array<{ definition: string; description: string }>;
}

function normaliseCategory(category?: string | null): string {
	const trimmed = category?.trim();
	return trimmed && trimmed.length > 0 ? trimmed : "General";
}

export class CompactHelpCommand extends Command {
	static paths = [["-h"], ["--help"], ["help"]];

	async execute(): Promise<number> {
		const definitions = this.cli.definitions({
			colored: false,
		}) as CommandDefinition[];
		const grouped = new Map<string, CommandDefinition[]>();

		for (const def of definitions) {
			const category = normaliseCategory(def.category);
			if (!grouped.has(category)) {
				grouped.set(category, []);
			}
			grouped.get(category)!.push(def);
		}

		const categories = Array.from(grouped.keys()).sort((a, b) => {
			if (a === "General" && b !== "General") return -1;
			if (b === "General" && a !== "General") return 1;
			return a.localeCompare(b);
		});

		const headerLabel =
			this.cli.binaryLabel ?? this.cli.binaryName ?? "linear-sh";
		const headerVersion = this.cli.binaryVersion
			? ` ${this.cli.binaryVersion}`
			: "";
		const header = `${headerLabel}${headerVersion}`;
		const lines: string[] = [];

		lines.push(header);
		lines.push("=".repeat(header.length));
		lines.push("");
		lines.push("Usage: linear-sh <command> [options]");
		lines.push("");
		lines.push("Commands:");

		for (const category of categories) {
			const commands = grouped.get(category)!;
			commands.sort((a, b) => a.usage.localeCompare(b.usage));

			for (const command of commands) {
				if (command.description && command.description.trim().length > 0) {
					const summary = command.description.split(".")[0] + ".";
					lines.push(`  ${command.usage.padEnd(20)} ${summary}`);
				} else {
					lines.push(`  ${command.usage}`);
				}
			}
		}

		lines.push("");
		lines.push("Options:");
		lines.push(
			"  --help-verbose  Show detailed help with all options and examples",
		);
		lines.push("  --version       Show version number");
		lines.push("");
		lines.push(
			"Run 'linear-sh --help-verbose' for detailed command information.",
		);

		this.context.stdout.write(`${lines.join("\n")}`);
		return 0;
	}
}

export class DetailedHelpCommand extends Command {
	static paths = [["--help-verbose"]];

	async execute(): Promise<number> {
		const definitions = this.cli.definitions({
			colored: false,
		}) as CommandDefinition[];
		const grouped = new Map<string, CommandDefinition[]>();

		for (const def of definitions) {
			const category = normaliseCategory(def.category);
			if (!grouped.has(category)) {
				grouped.set(category, []);
			}
			grouped.get(category)!.push(def);
		}

		const categories = Array.from(grouped.keys()).sort((a, b) => {
			if (a === "General" && b !== "General") return -1;
			if (b === "General" && a !== "General") return 1;
			return a.localeCompare(b);
		});

		const headerLabel =
			this.cli.binaryLabel ?? this.cli.binaryName ?? "linear-sh";
		const headerVersion = this.cli.binaryVersion
			? ` ${this.cli.binaryVersion}`
			: "";
		const header = `${headerLabel}${headerVersion}`;
		const lines: string[] = [];

		lines.push(header);
		lines.push("=".repeat(header.length));
		lines.push("");

		for (const category of categories) {
			const commands = grouped.get(category)!;
			commands.sort((a, b) => a.usage.localeCompare(b.usage));

			lines.push(`Category: ${category}`);
			lines.push("-".repeat(`Category: ${category}`.length));

			for (const command of commands) {
				lines.push(`Command: ${command.usage}`);
				if (command.description && command.description.trim().length > 0) {
					const summary = command.description.replace(/\s+/g, " ").trim();
					lines.push(`  Summary: ${summary}`);
				}

				if (command.options && command.options.length > 0) {
					lines.push("  Flags:");
					for (const option of command.options) {
						const definition = option.definition.trim();
						const description = option.description.replace(/\s+/g, " ").trim();
						lines.push(
							`    ${definition}${description ? `  ${description}` : ""}`,
						);
					}
				}

				if (command.details && command.details.trim().length > 0) {
					const detailLines = command.details
						.split(/\r?\n/)
						.map((line) => line.trim())
						.filter((line) => line.length > 0);

					if (detailLines.length > 0) {
						lines.push("  Details:");
						for (const detailLine of detailLines) {
							lines.push(`    ${detailLine}`);
						}
					}
				}

				if (command.examples && command.examples.length > 0) {
					lines.push("  Examples:");
					for (const [label, example] of command.examples) {
						const labelText = label.replace(/\s+/g, " ").trim();
						const resolvedExample = example
							.replace(/\$0/g, this.cli.binaryName)
							.trim();
						lines.push(`    - ${labelText}: ${resolvedExample}`);
					}
				}

				lines.push("");
			}
		}

		lines.push(
			"Tip: Append '-h' to any command for an even more verbose breakdown including option defaults.",
		);
		lines.push("");

		this.context.stdout.write(`${lines.join("\n")}`);
		return 0;
	}
}
