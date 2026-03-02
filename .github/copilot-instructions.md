# Copilot Instructions

## What This Project Is

Picobot is a **Node.js Telegram bot** that acts as a personal AI orchestrator. The user chats with a single main agent (Pico) which interprets requests and delegates work to a roster of specialized subagents — each responsible for a specific domain (email, calendar, drive, browser, coding, web research, scheduling, system administration). The main agent's only real tool is `subagent`: it writes a detailed task brief and fires off the right specialist, reviews results, and iterates until the job is done. AI inference is handled via **OpenRouter**, supporting any model (Claude, GPT, Gemini, Grok, etc.) and swappable at runtime.

---

## Technical Structure

### Source Layout (`src/`)

| Folder | Responsibility |
|---|---|
| `channel/` | Telegram integration — receives messages, dispatches commands, handles auth |
| `agent/` | Core orchestration logic — agent loop, prompt assembly, tool execution, task registry |
| `tools/` | All tool implementations grouped by domain (gmail, calendar, drive, browser, shell, etc.) |
| `llm/` | LLM abstraction layer over OpenRouter |
| `session/` | In-memory + persistent conversation session management |
| `crons/` | Persistent cron job management for scheduled tasks |
| `config/` | Config loading and Zod schema validation |
| `bus/` | Internal message bus |
| `cli/` | CLI commands for onboarding, status, prompt preview, and reset |
| `utils/` | Shared utilities (Google OAuth client, logger, helpers) |

### Prompt Architecture (`~/.picobot/prompts/`)

Agent behavior is **entirely driven by markdown prompt files** — no behavior is hardcoded.

- **Main agent prompt** is assembled from: `AGENTS.md` (orchestration rules + subagent list) + `SOUL.md` (personality) + `TOOLS.md` (tool guidelines) + `SKILLS.md` (available skills index).
- **Subagent prompts** are assembled from: `SUBAGENT.md` (shared subagent rules) + `agents/<name>.md` (agent-specific instructions via YAML frontmatter + markdown body) + `TOOLS.md` (scoped to allowed tools).
- **Skills** (`~/.picobot/skills/<skill>/SKILL.md`) are reusable step-by-step workflows the main agent loads on demand via `read_file` and follows to complete complex multi-step tasks.

---

## Golden Rules

1. Always follow the project conventions defined in the available skills — do not invent new patterns.
2. **Before executing any action that matches the intent of an available skill, ALWAYS read that skill file in full first.** Do not rely on memory or assumptions — read the file every time, even for tasks that seem familiar.
3. Never break the security non-negotiables (auth checks, Zod validation, ownership verification, no direct Knex in API handlers).