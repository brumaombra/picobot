# squadforge

Opinionated JavaScript framework for building a single main-agent entrypoint backed by a squad of specialized subagents.

## Current MVP

This first cut focuses on the core filesystem-driven abstraction layer:

- automatically load `leader.md` plus subagent markdown files from an `agents/` folder during agent runtime assembly
- automatically compose prompts from shared markdown fragments in a `prompts/` folder during agent runtime assembly
- automatically load skills from `skills/<skill-id>/SKILL.md` folders during agent runtime assembly
- parse frontmatter metadata such as `name`, `description`, `model`, and `allowed_tools`
- automatically load tools from a `tools/` folder during agent runtime assembly, including nested tool folders
- expose a single `forge(...)` entrypoint while the framework runtime manages loaded definitions, active subagents, and session storage

The orchestration loop and long-lived chat runtime are built into the framework without changing the folder conventions.

## Folder Convention

```text
my-app/
  agents/
    leader.md
    researcher.md
    coder.md
  prompts/
    SUBAGENTS.md
    TOOLS.md
    SKILLS.md
    SUBAGENT.md
  skills/
    research-report/
      SKILL.md
  tools/
    web/
      web_search.js
    filesystem/
      read_file.js
```

## Agent Markdown

```md
---
name: Researcher
description: Searches the web and summarizes findings.
allowed_tools:
  - web_search
model: openai/gpt-5-mini
---

You are a research specialist.
```

## Prompt Composition

Squadforge uses the body of each markdown file in `agents/` as the base prompt for that agent.

- The leader prompt is composed from `agents/leader.md` plus `prompts/SUBAGENTS.md`, `prompts/TOOLS.md`, and `prompts/SKILLS.md`.
- Subagent prompts are composed from `prompts/SUBAGENT.md`, the subagent markdown body, and `prompts/TOOLS.md`.

If the `prompts/` directory or any of its supported prompt files are missing, Squadforge automatically creates them from the framework's bundled defaults.

The leader personality and orchestration style should live directly in `agents/leader.md`.

Supported placeholders inside prompt fragments:

- `{subagentsList}`
- `{toolsList}`
- `{skillsList}`

## Skills

Each skill lives in its own folder under `skills/` and must contain a `SKILL.md` file.

The skill frontmatter supports:

- `name`
- `description`

Loaded skills are injected into `prompts/SKILLS.md` and can be listed through the runtime.

## Runtime Usage

```js
import { forge, OpenRouterLlm } from 'squadforge';

const agent = await forge({
  rootDir: process.cwd(),
  llm: new OpenRouterLlm({ apiKey: process.env.OPENROUTER_API_KEY }),
  model: 'x-ai/grok-4.1-fast'
});

agent.onMessage(receiveMessage => {
  telegram.on('message', update => {
    receiveMessage({
      sessionId: `telegram:${update.chat.id}`,
      role: 'user',
      content: update.text,
      replyToId: update.message_id
    });
  });
});

agent.sendMessage(async message => {
  await telegram.sendMessage(message.sessionId.split(':')[1], message.content);
});

await agent.start();
```

This makes Squadforge behave much more like Pico: the framework runs as a long-lived chat runtime, inbound channel messages are forwarded into it, and assistant replies are sent back out through one configured sender.

Leader agents also get Pico-style subagent primitives out of the box:

- `subagent_start` launches a specialized subagent in the background.
- `subagent_chat` sends a follow-up or answers a waiting subagent question.
- `subagent_list` shows the active subagents for the current session.

Subagents automatically receive `ask_main_agent` so they can pause and request clarification from the leader when needed.

## Channel Contract

Squadforge keeps channel integration outside the core runtime, but it now exposes a minimal shared message contract so adapters like Pico can plug in cleanly.

Inbound messages accepted by `onMessage(...)`:

- `sessionId` or `sessionKey`: required session identifier. Both are accepted and normalized internally.
- `role`: optional message role, defaults to `user`.
- `content`: optional text content, defaults to an empty string.
- `replyToId`: optional transport-specific reply target.
- `metadata`: optional adapter-defined metadata object.
- `file`: optional transport-defined file payload for inbound adapters that want to pass media context through.

Outbound messages emitted through `sendMessage(...)` and direct runtime sends:

- `sessionId`: normalized session identifier.
- `sessionKey`: alias of `sessionId` for Pico-style adapters.
- `role`: usually `assistant`.
- `content`: text content.
- `replyToId`: optional reply target.
- `metadata`: passthrough adapter metadata.
- `timedOut`: optional timeout flag.
- `error`: optional error string.
- `file`: optional outbound file payload.

Outbound file payload shape:

- `path`: absolute or workspace-resolved file path.
- `caption`: optional caption text.
- `name`: optional display name.
- `mimeType`: optional MIME type.
- `metadata`: optional adapter-specific file metadata.

The framework now exposes `send_file` as a generic predefined leader tool and exports the normalization helpers from the package entrypoint so adapters can reuse the same envelope shape.

## Runtime Policies

Squadforge now applies a soft run deadline model by default:

- soft run deadline per agent run: 5 minutes
- wrap-up warning injection before the deadline: 60 seconds remaining
- session trimming: keep system messages plus the newest messages up to 50 total
- stale session cleanup: expire non-leader sessions after 24 hours of inactivity
- transient retries: 2 retries for LLM calls

These can be overridden through `forge(...)`:

```js
const agent = await forge({
  maxRuntimeMs: 5 * 60 * 1000,
  wrapUpThresholdMs: 60 * 1000,
  maxMessagesPerSession: 50,
  sessionTtlMs: 24 * 60 * 60 * 1000,
  llmChatMaxRetries: 2
});
```

The deadline is checked between agent turns. It nudges the model to wrap up and stops the next turn once the budget is exhausted, but it does not cancel an in-flight LLM request or running tool.

## Public Surface

- `OpenRouterLlm`
- `forge`

The folder loaders are internal implementation details. Consumers initialize a root agent through `forge(...)`, and squadforge loads the `agents/`, `skills/`, and nested `tools/` folders automatically. When `rootDir` is omitted, squadforge defaults it to the current working directory.