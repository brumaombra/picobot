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
- 🎭 **Fully Customizable** — Personality, behavior, and prompts are all yours to tweak

## 🤖 How It Works

Picobot uses an **orchestrator + subagents** architecture. You talk to one main agent (Pico), which delegates work to a roster of specialists:

| Agent | What It Does |
|-------|-------------|
| 📧 **Email Manager** | Search, read, and send Gmail messages |
| 📅 **Calendar Manager** | Create, update, and manage Google Calendar events |
| 💾 **Drive Manager** | List, read, create, and share Google Drive files |
| 📁 **File Manager** | Read, write, search, and organize local files |
| 💻 **Code Implementer** | Write, refactor, and test code with execution tools |
| 🌐 **Web Researcher** | Search the web and synthesize information |
| 🧭 **Web Navigator** | Control a browser to interact with pages and fill forms |
| ⏰ **Task Scheduler** | Set up crons and automated recurring tasks |
| 🖥️ **System Admin** | Monitor system health and manage processes |

The main agent only has one real tool: **`subagent`**. It reads your message, picks the right specialist(s), writes a detailed task brief, and kicks off the work. Subagents execute autonomously with their own dedicated toolset and report back. The main agent reviews the results and iterates if needed — it's the supervisor, not a pass-through.

## 🧬 Prompt Architecture

Picobot's behavior is fully driven by markdown prompt files that live in `~/.picobot/prompts/`. Here's how they compose:

### Main Agent Prompt

The main agent's system prompt is assembled from three files:

```
AGENTS.md   →  Orchestration instructions + available subagents list
SOUL.md     →  Personality, tone, and communication style
TOOLS.md    →  Tool usage guidelines + tools list
```

- **`AGENTS.md`** — Defines the main agent's role as orchestrator, delegation strategy, quality control rules, and lists all available subagents (auto-populated from agent definitions).
- **`SOUL.md`** — The personality layer. Defines character traits, values, and communication style. Want a pirate? A formal assistant? A chaotic gremlin? Edit this file.
- **`TOOLS.md`** — Generic tool usage guidelines (parallel execution rules, error handling). The `{toolsList}` placeholder is auto-replaced with the main agent's available tools.

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
| Brave Search API | [brave.com/search/api](https://brave.com/search/api) *(optional)* |

## 🎮 Commands

**Terminal:**

```bash
npm start          # 🚀 Launch the bot
npm run onboard    # 🧙 Setup wizard  
npm run status     # 📊 Check config
npm run nuke       # 💥 Reset everything
```

**Telegram:** `/start` (new conversation) · `/model` (switch model) · `/models` (list models)

## ⚙️ Configuration

Everything lives in `~/.picobot/config.json`:

```json
{
  "telegram": {
    "token": "your-bot-token",
    "allowedUsers": ["your-telegram-id"]
  },
  "openRouter": {
    "apiKey": "sk-or-..."
  },
  "agent": {
    "model": "x-ai/grok-4.1-fast"
  },
  "brave": {
    "apiKey": "BSA..."
  }
}
```

> 💡 **Tip:** Leave `allowedUsers` empty to let anyone use your bot. Add user IDs to restrict access.

### 🔐 Google Setup (Optional)

Want email, calendar, and drive powers?

1. Create a project at [Google Cloud Console](https://console.cloud.google.com)
2. Enable Gmail, Calendar, and Drive APIs
3. Create OAuth 2.0 credentials → Download as `credentials.json`
4. Drop it in the project root
5. Start the bot — it'll ask you to authorize

---

<div align="center">

**Built with ☕ and questionable life choices**

[MIT License](LICENSE) • Made for humans who hate context-switching

</div>

</div>