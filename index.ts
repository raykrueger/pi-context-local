/**
 * Local Context Files Extension
 *
 * After pi loads AGENTS.md or CLAUDE.md from a directory, this extension
 * checks for a `<basename>.local.md` sibling (e.g. AGENTS.local.md) and
 * appends its contents to the system prompt if found.
 *
 * Placement: ~/.pi/agent/extensions/context-local/index.ts (global)
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const BASENAMES = ["AGENTS", "CLAUDE"];

function readLocalFile(basePath: string): { path: string; content: string } | null {
	for (const basename of BASENAMES) {
		const localPath = path.join(basePath, `${basename}.local.md`);
		if (fs.existsSync(localPath)) {
			return { path: localPath, content: fs.readFileSync(localPath, "utf-8") };
		}
	}
	return null;
}

export default function (pi: ExtensionAPI) {
	pi.on("before_agent_start", async (event) => {
		const contextFiles = event.systemPromptOptions?.contextFiles;
		if (!contextFiles || contextFiles.length === 0) return;

		const seen = new Set<string>();
		const localContents: string[] = [];

		for (const cf of contextFiles) {
			const dir = path.dirname(cf.path);

			// Deduplicate directories (e.g. if AGENTS.md and CLAUDE.md share a dir)
			if (seen.has(dir)) continue;
			seen.add(dir);

			const result = readLocalFile(dir);
			if (result) {
				localContents.push(`--- ${result.path} ---\n\n${result.content}`);
			}
		}

		if (localContents.length === 0) return;

		return {
			systemPrompt:
				event.systemPrompt +
				`\n\n## Local Context Files\n\n${localContents.join("\n\n")}`,
		};
	});
}
