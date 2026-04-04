<div align="center">

# 🦜 Picobot AI Agent

### Your pocket-sized AI sidekick that lives in Telegram

*Small name. Big brain. Unlimited sass (configurable).*

Picobot is a Telegram-first AI assistant built on top of the **Squadforge** framework, with a main orchestrator agent, specialized subagents, tools, prompts, skills, sessions, and cron workflows.

<p>
  <a href="https://github.com/brumaombra/picobot"><img alt="GitHub Repo" src="https://img.shields.io/badge/github-brumaombra%2Fpicobot-111111?logo=github"></a>
  <img alt="Node 18+" src="https://img.shields.io/badge/node-%3E%3D18-3C873A?logo=node.js&logoColor=white">
  <img alt="License MIT" src="https://img.shields.io/badge/license-MIT-2563EB">
  <img alt="Telegram First" src="https://img.shields.io/badge/interface-Telegram-26A5E4?logo=telegram&logoColor=white">
  <img alt="Powered by Squadforge" src="https://img.shields.io/badge/powered%20by-Squadforge-F59E0B">
</p>

<p>
  💬 Telegram-native assistant • 🤖 Main agent + subagents • 🧩 Prompt-driven behavior • 🛠️ Real tools • ⏰ Cron workflows
</p>

<p>
  <a href="#whats-this"><strong>What's This?</strong></a> •
  <a href="#-features"><strong>Features</strong></a> •
  <a href="#-how-it-works"><strong>How It Works</strong></a> •
  <a href="#-quick-start"><strong>Quick Start</strong></a> •
  <a href="#-commands"><strong>Commands</strong></a> •
  <a href="#-configuration"><strong>Configuration</strong></a>
</p>

</div>

## What's This?

Picobot is an ultra-lightweight AI assistant that lives in your Telegram and actually *does stuff*. Not just chat — it orchestrates a team of specialized AI subagents to handle emails, calendars, files, web browsing, coding, and more. All from your favorite messaging app.

Under the hood, Pico runs on top of the **Squadforge** framework, which powers its agent runtime, subagent orchestration, sessions, tools, prompts, and cron workflows.

Think of it as a tiny manager with a staff of specialists, running on whichever AI model fits your mood (or budget) — Claude, GPT, Gemini, Grok, you name it.

## ✨ Features

- 💬 **Telegram Native** — Chat naturally, no clunky interfaces
- 🧠 **Multi-Model** — Swap between AI models on the fly via OpenRouter
- 🤖 **Subagent Architecture** — Specialized agents for every task, orchestrated by a central brain
- 📷 **NVR Camera Ops** — Get camera/NVR status, take snapshots, search recordings, and download clips
- 🎥🖼️ **AI Video/Image Analysis** — Analyze downloaded camera footage and local/snapshot images with Google AI using natural-language prompts
- 🎭 **Fully Customizable** — Personality, behavior, and prompts are all yours to tweak
- ✨ **And much more!** — Picobot includes many additional capabilities across email, Drive, calendar, coding, web automation, and custom skill workflows!

## 🤖 How It Works

Picobot is an app built on the **Squadforge** framework. Squadforge provides the runtime and orchestration layer; Pico is the Telegram-first assistant configuration that sits on top of it.

Picobot uses an **orchestrator + subagents** architecture. You talk to one main agent (Pico), which delegates work to a roster of specialists:

| Agent | What It Does |
|-------|-------------|
| 📧 **Email Manager** | Search, read, and send Gmail messages (with attachments) |
| 📅 **Calendar Manager** | Create, update, and manage Google Calendar events |
| 💾 **Drive Manager** | List, read, create, and share Google Drive files |
| 🖼️ **Slides Manager** | Create, edit, and manage Google Slides presentations |
| 📷 **Security Camera Manager** | Get Reolink NVR info, capture snapshots, search/download recordings, and analyze video/image content |
| 🎨 **Artist** | Generate AI images from text prompts and iterate on style/composition |
| 🌐 **Network Administrator** | Run network diagnostics like ping checks and local device discovery |
| 🖨️ **Printer Manager** | Manage printers: list devices, inspect status/queues, and print files |
| 💻 **Code Implementer** | Write, refactor, and test code with execution tools |
| 🌐 **Web Researcher** | Search the web, fetch pages, and call structured APIs when needed |
| 🧭 **Web Navigator** | Control a browser to interact with pages, fill forms, and fall back to direct API calls when appropriate |
| ⏰ **Task Scheduler** | Set up crons and automated recurring tasks |
| 🖥️ **System Admin** | Monitor system health and manage processes |

Pico still behaves like a supervisor rather than a pass-through: it decides which specialist to involve, writes the task brief, reviews the results, and iterates when needed.

In the current Squadforge-based runtime, Pico gets a small built-in leader toolset automatically:

- `subagent_start` — launch a specialized subagent in the background
- `subagent_chat` — send follow-ups or answer a subagent while it is running
- `subagent_list` — inspect active subagents for the current session
- `read_file`, `send_file`, and `get_datetime` — shared leader utilities injected by the framework

Subagents automatically receive `ask_main_agent` plus their own allowed app tools.

## 🧬 Prompt Architecture

Picobot's behavior is driven by markdown files bootstrapped directly into your home directory under `~/.picobot/`. During onboarding, Pico copies the default agents, prompts, and skills from the project into those folders and then runs Squadforge from the copied versions, so you can customize them without editing the project checkout.

### Main Agent Prompt

The main agent's system prompt is assembled by Squadforge from these files:

```
~/.picobot/agents/leader.md      →  Pico's core identity, orchestration rules, and personality
~/.picobot/prompts/SUBAGENTS.md  →  Shared subagent list and delegation guidance
~/.picobot/prompts/TOOLS.md      →  Tool usage rules + injected tools list
~/.picobot/prompts/SKILLS.md     →  Skills index + injected skill metadata
```

- **`~/.picobot/agents/leader.md`** — Defines Pico itself. This is where the main assistant's orchestration behavior, tone, personality, cron-handling instructions, and user-facing communication style now live.
- **`~/.picobot/prompts/SUBAGENTS.md`** — Shared leader-side guidance about delegation plus the auto-populated list of available subagents.
- **`~/.picobot/prompts/TOOLS.md`** — Shared tool usage rules. Squadforge injects Pico's actual built-in and app-level tools into the `{toolsList}` placeholder at runtime.
- **`~/.picobot/prompts/SKILLS.md`** — Shared skills index. Squadforge injects all loaded skills into the `{skillsList}` placeholder with names, descriptions, and file paths.

### Subagent Prompt

Each subagent gets its own system prompt assembled from:

```
~/.picobot/prompts/SUBAGENT.md   →  Generic subagent behavior rules
~/.picobot/agents/<agent>.md     →  Agent-specific instructions and frontmatter
~/.picobot/prompts/TOOLS.md      →  Tool usage guidelines + injected tools list
```

- **`~/.picobot/prompts/SUBAGENT.md`** — Shared rules for all subagents.
- **`~/.picobot/agents/<agent>.md`** — One file per subagent under `~/.picobot/agents/`, with YAML frontmatter such as `name`, `description`, and `allowed_tools`, plus the markdown body containing domain-specific instructions.
- **`~/.picobot/prompts/TOOLS.md`** — The same shared tool guidance template, but populated with only the tools available to that specific subagent. Squadforge also injects subagent built-ins like `ask_main_agent` and `get_datetime` automatically.

### Skills

Skills are reusable, pre-defined workflows that guide the main agent through complex, multi-step tasks. Unlike subagents (which execute work), a skill defines *how* to coordinate tools and subagents to complete a broader objective consistently.

Skills follow the same structure as Anthropic skills — one folder per skill, with a `SKILL.md` file inside:

```
~/.picobot/skills/
  research-report/
    SKILL.md   →  Frontmatter (name, description) + step-by-step workflow
  my-custom-skill/
    SKILL.md
```

At startup, Squadforge loads every skill under `~/.picobot/skills/` and injects its metadata into `~/.picobot/prompts/SKILLS.md`. When a user request matches a skill, Pico uses `read_file` to load that skill's `SKILL.md` on demand and follows the workflow from there.

## 🚀 Quick Start

```bash
# Clone it
git clone https://github.com/brumaombra/picobot.git && cd picobot

# Install dependencies
npm install

# Let the wizard guide you ✨
npm run onboard
```

The onboarding wizard will walk you through everything. It's friendly, we promise.

## 📋 Requirements

| What | Where to Get It |
|------|-----------------|
| Node.js 18+ | [nodejs.org](https://nodejs.org) |
| Telegram Bot Token | [@BotFather](https://t.me/BotFather) |
| OpenRouter API Key | [openrouter.ai](https://openrouter.ai) |
| Google credentials | [Cloud Console](https://console.cloud.google.com) *(optional)* |
| Google AI API Key | [Google AI Studio](https://aistudio.google.com/app/apikey) *(optional, for video/image analysis)* |
| Brave Search API | [brave.com/search/api](https://brave.com/search/api) *(optional)* |
| Reolink NVR host + credentials | Your NVR admin settings *(optional, for camera tools)* |

## 🎮 Commands

**Terminal:**

```bash
npm start          # 🚀 Launch the bot
npm run onboard    # 🧙 Setup wizard  
npm run status     # 📊 Check config
npm run logs       # 📚 Show recent runtime logs
npm run nuke       # 💥 Reset everything
```

**Telegram:** `/start` (show welcome message) · `/new` (clear the current conversation) · `/models` (list models) · `/model` (switch model)

## ⚙️ Configuration

Picobot keeps these user-level files under `~/.picobot/`:

- `config.json`
- `agents/`
- `prompts/`
- `skills/`
- `sessions/`
- `logs/`
- `crons/`
- `workspace/`

During onboarding, Pico copies the default agents, prompts, and skills from the project into `~/.picobot/` without overwriting any files you already customized there.

The main configuration file lives in `~/.picobot/config.json`:

```json
{
  "workspace": "~/.picobot/workspace",
  "telegram": {
    "token": "",
    "allowedUsers": []
  },
  "openRouter": {
    "apiKey": ""
  },
  "agent": {
    "model": "x-ai/grok-4.1-fast"
  },
  "brave": {
    "apiKey": ""
  },
  "googleAi": {
    "apiKey": ""
  },
  "nvr": {
    "host": "",
    "username": "",
    "password": ""
  }
}
```

> 🔐 **Security:** `allowedUsers` is required and must include at least one Telegram user ID or `@username`.

### Runtime Storage

Picobot splits Squadforge data into two places:

- `~/.picobot/` for user-owned agents, prompts, skills, sessions, logs, and crons
- `app/` in the project for app tools only

The project-local `app/` directory contains:

- `app/tools/` — app-specific tool implementations loaded into the runtime

This means Pico's editable behavior plus runtime data all live under your home directory, while tool code stays in the project.

### 🔒 Secret Overrides (Recommended)

You can keep secrets out of `config.json` and provide them through environment variables:

Use `.env.example` as the template for supported secret names.

```powershell
$env:TELEGRAM_BOT_TOKEN="..."
$env:TELEGRAM_ALLOWED_USERS="@username,123456789"
$env:OPENROUTER_API_KEY="..."
$env:OPENROUTER_MODEL="x-ai/grok-4.1-fast"
$env:BRAVE_API_KEY="..."
$env:GOOGLE_AI_API_KEY="..."
$env:NVR_HOST="..."
$env:NVR_USERNAME="..."
$env:NVR_PASSWORD="..."
```

`TELEGRAM_ALLOWED_USERS` must be a comma-separated list of Telegram user IDs and/or `@usernames`.

When an env var is present, it overrides the corresponding value in `config.json`.

Tip: if you use a process manager or shell profile, load the values before running `npm start`.

### 🔐 Google Setup (Optional)

Want email, calendar, and drive powers?

1. Create a project at [Google Cloud Console](https://console.cloud.google.com)
2. Enable Gmail, Calendar, Drive, and Slides APIs
3. Create OAuth 2.0 credentials → Download as `credentials.json`
4. Drop it in the project root
5. Start the bot — it'll ask you to authorize

---

<div align="center">

**Built with ☕ and questionable life choices**

[MIT License](LICENSE) • Made for humans who hate context-switching

</div>

</div>