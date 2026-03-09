# squadforge

Opinionated JavaScript framework for building a single main-agent entrypoint backed by a team of specialized subagents.

## Current MVP

This first cut focuses on the core filesystem-driven abstraction layer:

- load `main.md` plus subagent markdown files from an `agents/` folder
- parse frontmatter metadata such as `name`, `description`, `model`, and `allowed_tools`
- dynamically load tools from a `tools/` folder
- expose a single `Agent` class that owns the main agent, loaded subagent definitions, active subagent instances, and chat history storage

The orchestration loop and LLM adapter layer can be added on top of this base without changing the folder conventions.

## Folder Convention

```text
my-app/
  agents/
    main.md
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
import { Agent } from 'squadforge';

const agent = await Agent.fromDirectory({
    rootDir: process.cwd()
});

await agent.send('Plan a research task for the team.');
const subagent = agent.spawnSubagent('researcher', {
    prompt: 'Investigate the latest model releases.'
});
```

## Public Surface

- `Agent`
- `AgentDefinition`
- `SubagentInstance`
- `InMemoryMessageStore`
- `loadAgentsFromDirectory`
- `loadToolsFromDirectory`