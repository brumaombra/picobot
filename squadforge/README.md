# squadforge

Opinionated JavaScript framework for building a single main-agent entrypoint backed by a team of specialized subagents.

## Current MVP

This first cut focuses on the core filesystem-driven abstraction layer:

- automatically load `leader.md` plus subagent markdown files from an `agents/` folder during squad initialization
- parse frontmatter metadata such as `name`, `description`, `model`, and `allowed_tools`
- automatically load tools from a `tools/` folder during squad initialization
- expose a single `Squad` class that owns the main agent, loaded subagent definitions, active subagent instances, and session storage

The orchestration loop and LLM adapter layer can be added on top of this base without changing the folder conventions.

## Folder Convention

```text
my-app/
  agents/
    leader.md
    researcher.md
    coder.md
  tools/
    web_search.js
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

## Usage

```js
import { Squad } from 'squadforge';

const squad = await Squad.assemble();

await squad.send('Plan a research task for the team.');
const subagent = squad.spawnSubagent('researcher', {
    prompt: 'Investigate the latest model releases.'
});
```

## Public Surface

- `Squad`
- `AgentSpec`
- `SessionStore`

The folder loaders are internal implementation details. Consumers initialize a squad through `Squad.assemble(...)`, and squadforge loads the `agents/` and `tools/` folders automatically. When `rootDir` is omitted, squadforge defaults it to the current working directory.