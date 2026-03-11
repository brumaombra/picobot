# squadforge

Opinionated JavaScript framework for building a single main-agent entrypoint backed by a team of specialized subagents.

## Current MVP

This first cut focuses on the core filesystem-driven abstraction layer:

- automatically load `leader.md` plus subagent markdown files from an `agents/` folder during squad initialization
- automatically compose prompts from shared markdown fragments in a `prompts/` folder during squad initialization
- automatically load skills from `skills/<skill-id>/SKILL.md` folders during squad initialization
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
  prompts/
    SUBAGENTS.md
    TOOLS.md
    SKILLS.md
    SUBAGENT.md
  skills/
    research-report/
      SKILL.md
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