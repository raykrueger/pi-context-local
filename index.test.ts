/**
 * Tests for the pi-context-local extension.
 *
 * Run with: npm test (or `node --test index.test.ts`)
 *
 * Strategy:
 * - The default export is called with a mock ExtensionAPI that captures the
 *   "before_agent_start" handler; tests then call the handler directly with
 *   synthetic events.
 * - Context files (AGENTS.md / CLAUDE.md and their *.local.md siblings) are
 *   created in a temp directory so no real context files are touched.
 */
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, beforeEach, test } from "node:test";

const ROOT = mkdtempSync(join(tmpdir(), "pi-context-local-test-"));

type Event = {
	systemPrompt: string;
	systemPromptOptions?: { contextFiles?: Array<{ path: string }> };
};
type Handler = (event: Event) => { systemPrompt: string } | undefined | Promise<{ systemPrompt: string } | undefined>;

let handler: Handler;

before(async () => {
	const mod = await import("./index.ts");
	mod.default({
		on: (name: string, h: unknown) => {
			assert.equal(name, "before_agent_start");
			handler = h as Handler;
		},
	});
});

after(() => {
	rmSync(ROOT, { recursive: true, force: true });
});

beforeEach(() => {
	rmSync(ROOT, { recursive: true, force: true });
});

/** Create a directory containing the given files (name → content). */
function makeDir(name: string, files: Record<string, string>): string {
	const dir = join(ROOT, name);
	rmSync(dir, { recursive: true, force: true });
	mkdirSync(dir, { recursive: true });
	for (const [file, content] of Object.entries(files)) {
		writeFileSync(join(dir, file), content);
	}
	return dir;
}

function eventFor(dirs: Array<Record<string, string>>, contextNames: string[] = ["AGENTS.md"]): Event {
	const dirsCreated = dirs.map((files, i) => makeDir(`dir${i}`, files));
	return {
		systemPrompt: "base prompt",
		systemPromptOptions: {
			contextFiles: contextNames.map((n, i) => ({ path: join(dirsCreated[i] ?? dirsCreated[0], n) })),
		},
	};
}

async function run(event: Event): Promise<string | undefined> {
	const res = await handler(event);
	return res?.systemPrompt;
}

test("no context files leaves the system prompt untouched", async () => {
	assert.equal(await run({ systemPrompt: "base" }), undefined);
	assert.equal(await run({ systemPrompt: "base", systemPromptOptions: { contextFiles: [] } }), undefined);
});

test("context file without a local sibling leaves the system prompt untouched", async () => {
	const prompt = await run(eventFor([{ "AGENTS.md": "agents" }]));
	assert.equal(prompt, undefined);
});

test("AGENTS.local.md is appended to the system prompt", async () => {
	const prompt = await run(eventFor([{ "AGENTS.md": "agents", "AGENTS.local.md": "local notes" }]));
	assert.match(prompt as string, /^base prompt/);
	assert.match(prompt as string, /## Local Context Files/);
	assert.match(prompt as string, /--- .*AGENTS\.local\.md ---/);
	assert.match(prompt as string, /local notes/);
});

test("CLAUDE.local.md is appended when CLAUDE.md is the context file", async () => {
	const prompt = await run(eventFor([{ "CLAUDE.md": "claude", "CLAUDE.local.md": "claude local" }], ["CLAUDE.md"]));
	assert.match(prompt as string, /CLAUDE\.local\.md/);
	assert.match(prompt as string, /claude local/);
});

test("AGENTS.local.md takes precedence over CLAUDE.local.md in the same directory", async () => {
	const prompt = await run(eventFor([{ "AGENTS.md": "a", "CLAUDE.md": "c", "AGENTS.local.md": "agents local", "CLAUDE.local.md": "claude local" }]));
	assert.match(prompt as string, /agents local/);
	assert.doesNotMatch(prompt as string, /claude local/);
});

test("duplicate directories are only appended once", async () => {
	const event = eventFor([{ "AGENTS.md": "a", "CLAUDE.md": "c", "AGENTS.local.md": "once" }], ["AGENTS.md", "CLAUDE.md"]);
	const prompt = (await run(event)) as string;
	assert.equal(prompt.match(/AGENTS\.local\.md/g)?.length, 1);
});

test("local files from multiple directories are all appended", async () => {
	const prompt = await run(eventFor([
		{ "AGENTS.md": "a", "AGENTS.local.md": "first local" },
		{ "AGENTS.md": "a", "AGENTS.local.md": "second local" },
	], ["AGENTS.md", "AGENTS.md"]));
	assert.match(prompt as string, /first local/);
	assert.match(prompt as string, /second local/);
});
