# Available Skills

Skills are reusable, pre-defined workflows that provide step-by-step guidance to accomplish complex, multi-step tasks. Unlike tools (which perform individual actions), a skill defines **how** to combine tools and subagents to complete a broader objective consistently and reliably.

## How to Use a Skill

When a user request matches an available skill:

1. Use the `read_file` tool to load the skill's `SKILL.md` file from its path listed below.
2. Read the skill instructions carefully before taking any action.
3. Follow the skill's workflow exactly as defined, delegating steps to the appropriate subagents.

## Guidelines

- Always load and read the skill file before starting — never rely on memory or assumptions about its content.
- Follow the skill's workflow as defined. Use your judgment to adapt it when the user's request only partially matches.
- Skills may reference specific subagents — verify those agents are available before proceeding.
- If a required subagent is not available, inform the user and attempt the task with the tools at your disposal.

## Available Skills

{skillsList}