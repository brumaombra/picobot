# squadforge

Opinionated JavaScript framework for building a single main-agent entrypoint backed by a team of specialized subagents.

## Current MVP

This first cut focuses on the core filesystem-driven abstraction layer:

- automatically load `leader.md` plus subagent markdown files from an `agents/` folder during squad initialization
- automatically compose prompts from shared markdown fragments in a `prompts/` folder during squad initialization
- automatically load skills from `skills/<skill-id>/SKILL.md` folders during squad initialization
- parse frontmatter metadata such as `name`, `description`, `model`, and `allowed_tools`
- automatically load tools from a `tools/` folder during squad initialization, including nested tool folders
- expose a single `Squad` class that owns the main agent, loaded subagent definitions, active subagent instances, and session storage

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

Loaded skills are injected into `prompts/SKILLS.md` and can be listed through the squad runtime.

## Runtime Usage

```js
import { OpenRouterLlm, Squad } from 'squadforge';

const squad = await Squad.assemble({
  rootDir: process.cwd(),
  llm: new OpenRouterLlm({ apiKey: process.env.OPENROUTER_API_KEY }),
  model: 'x-ai/grok-4.1-fast'
});

squad.onMessage(receiveMessage => {
  telegram.on('message', update => {
    receiveMessage({
      sessionId: `telegram:${update.chat.id}`,
      role: 'user',
      content: update.text,
      replyToId: update.message_id
    });
  });
});

squad.sendMessage(async message => {
  await telegram.sendMessage(message.sessionId.split(':')[1], message.content);
});

await squad.start();
```

This makes Squadforge behave much more like Pico: the framework runs as a long-lived chat runtime, inbound channel messages are forwarded into it, and assistant replies are sent back out through one configured sender.

## Runtime Policies

Squadforge now applies a soft run deadline model by default:

- soft run deadline per agent run: 5 minutes
- wrap-up warning injection before the deadline: 60 seconds remaining
- session trimming: keep system messages plus the newest messages up to 50 total
- stale session cleanup: expire non-leader sessions after 24 hours of inactivity
- transient retries: 2 retries for LLM calls

These can be overridden through `Squad.assemble(...)`:

```js
const squad = await Squad.assemble({
  maxRuntimeMs: 5 * 60 * 1000,
  wrapUpThresholdMs: 60 * 1000,
  maxMessagesPerSession: 50,
  sessionTtlMs: 24 * 60 * 60 * 1000,
  llmChatMaxRetries: 2
});
```

The deadline is checked between agent turns. It nudges the model to wrap up and stops the next turn once the budget is exhausted, but it does not cancel an in-flight LLM request or running tool.

## Public Surface

- `Agent`
- `Squad`
- `AgentSpec`
- `SessionStore`
- `OpenRouterLlm`

The folder loaders are internal implementation details. Consumers initialize a squad through `Squad.assemble(...)`, and squadforge loads the `agents/`, `skills/`, and nested `tools/` folders automatically. When `rootDir` is omitted, squadforge defaults it to the current working directory.