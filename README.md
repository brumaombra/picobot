<div align="center">

# 🦜 Picobot AI Agent

**Your pocket-sized AI sidekick that lives in Telegram**

*Small name. Big brain. Unlimited sass (configurable).*

[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

</div>

---

## What's This?

Picobot is an ultra-lightweight AI assistant that lives in your Telegram and actually *does stuff*. Not just chat — it orchestrates a team of specialized AI subagents to handle emails, calendars, files, web browsing, coding, and more. All from your favorite messaging app.

Think of it as a tiny manager with a staff of specialists, running on whichever AI model fits your mood (or budget) — Claude, GPT, Gemini, Grok, you name it.

## ✨ Features

- 💬 **Telegram Native** — Chat naturally, no clunky interfaces
- 🧠 **Multi-Model** — Swap between AI models on the fly via OpenRouter
- 🤖 **Subagent Architecture** — Specialized agents for every task, orchestrated by a central brain
- 📷 **NVR Camera Ops** — Get camera/NVR status, take snapshots, search recordings, and download clips
- 🎥 **AI Video Analysis** — Analyze downloaded camera footage with Google AI using natural-language prompts
- 🎭 **Fully Customizable** — Personality, behavior, and prompts are all yours to tweak
- ✨ **And much more!** — Picobot includes many additional capabilities across email, Drive, calendar, coding, web automation, and custom skill workflows!

## 🤖 How It Works

Picobot uses an **orchestrator + subagents** architecture. You talk to one main agent (Pico), which delegates work to a roster of specialists:

| Agent | What It Does |
|-------|-------------|
| 📧 **Email Manager** | Search, read, and send Gmail messages |
| 📅 **Calendar Manager** | Create, update, and manage Google Calendar events |
| 💾 **Drive Manager** | List, read, create, and share Google Drive files |
| 🖼️ **Slides Manager** | Create, edit, and manage Google Slides presentations |
| 📷 **Security Camera Manager** | Get Reolink NVR info, capture snapshots, search/download recordings, and analyze footage |
| 💻 **Code Implementer** | Write, refactor, and test code with execution tools |
| 🌐 **Web Researcher** | Search the web and synthesize information |
| 🧭 **Web Navigator** | Control a browser to interact with pages and fill forms |
| ⏰ **Task Scheduler** | Set up crons and automated recurring tasks |
| 🖥️ **System Admin** | Monitor system health and manage processes |

The main agent only has one real tool: **`subagent`**. It reads your message, picks the right specialist(s), writes a detailed task brief, and kicks off the work. Subagents execute autonomously with their own dedicated toolset and report back. The main agent reviews the results and iterates if needed — it's the supervisor, not a pass-through.

## 🧬 Prompt Architecture

Picobot's behavior is fully driven by markdown prompt files that live in `~/.picobot/prompts/`. Here's how they compose:

### Main Agent Prompt

The main agent's system prompt is assembled from four files:

```
AGENTS.md   →  Orchestration instructions + available subagents list
SOUL.md     →  Personality, tone, and communication style
TOOLS.md    →  Tool usage guidelines + tools list
SKILLS.md   →  Available skills list with file paths for on-demand loading
```

- **`AGENTS.md`** — Defines the main agent's role as orchestrator, delegation strategy, quality control rules, and lists all available subagents (auto-populated from agent definitions).
- **`SOUL.md`** — The personality layer. Defines character traits, values, and communication style. Want a pirate? A formal assistant? A chaotic gremlin? Edit this file.
- **`TOOLS.md`** — Generic tool usage guidelines (parallel execution rules, error handling). The `{toolsList}` placeholder is auto-replaced with the main agent's available tools.
- **`SKILLS.md`** — Lists all available skills with their names, descriptions, and file paths. The `{skillsList}` placeholder is auto-replaced at startup. The main agent reads a skill file on demand using `read_file` and follows its workflow.

### Subagent Prompt

Each subagent gets its own system prompt assembled from:

```
SUBAGENT.md       →  Generic subagent behavior rules
<agent>.md        →  Agent-specific instructions (e.g. email.md, coder.md)
TOOLS.md          →  Tool usage guidelines + agent-specific tools list
```

- **`SUBAGENT.md`** — Shared instructions for all subagents (focus on task, report results, ask for clarification only when necessary).
- **`<agent>.md`** — Lives in `~/.picobot/agents/`. Each file defines one subagent via YAML frontmatter (`name`, `description`, `allowed_tools`) and markdown body (detailed instructions).
- **`TOOLS.md`** — Same template as the main agent, but populated with only the tools that specific subagent is allowed to use.

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

At startup, all skills are loaded and their metadata (name, description, file path) is injected into the main agent's `SKILLS.md` prompt. When the user's request matches a skill, the main agent uses `read_file` to load that skill's `SKILL.md` on demand, then follows its workflow — delegating steps to the appropriate subagents.

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
| Google AI API Key | [Google AI Studio](https://aistudio.google.com/app/apikey) *(optional, for video analysis)* |
| Brave Search API | [brave.com/search/api](https://brave.com/search/api) *(optional)* |
| Reolink NVR host + credentials | Your NVR admin settings *(optional, for camera tools)* |

## 🎮 Commands

**Terminal:**

```bash
npm start          # 🚀 Launch the bot
npm run onboard    # 🧙 Setup wizard  
npm run status     # 📊 Check config
npm run nuke       # 💥 Reset everything
npm run prompts    # ✏️ Preview the prompts
```

**Telegram:** `/start` (new conversation) · `/model` (switch model) · `/models` (list models)

## ⚙️ Configuration

Everything lives in `~/.picobot/config.json`:

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

> 💡 **Tip:** Leave `allowedUsers` empty to let anyone use your bot. Add user IDs to restrict access.

### 🔒 Secret Overrides (Recommended)

You can keep secrets out of `config.json` and provide them through environment variables:

```powershell
$env:TELEGRAM_BOT_TOKEN="..."
$env:OPENROUTER_API_KEY="..."
$env:BRAVE_API_KEY="..."
$env:GOOGLE_AI_API_KEY="..."
$env:NVR_HOST="..."
$env:NVR_USERNAME="..."
$env:NVR_PASSWORD="..."
```

When an env var is present, it overrides the corresponding value in `config.json`.

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