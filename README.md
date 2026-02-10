<div align="center">

# 🦜 Picobot

**Your pocket-sized AI sidekick that lives in Telegram**

*Small name. Big brain. Unlimited sass (configurable).*

[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

</div>

---

## What's This?

Picobot is an ultra-lightweight AI assistant that chills in your Telegram and actually *does stuff*. Not just chat — it reads your emails, manages your calendar, searches the web, handles files, and runs scheduled tasks. All from your favorite messaging app.

Think of it as having a personal intern who never sleeps, never complains, and can switch between Claude, GPT, Gemini, or Grok depending on your mood (or budget).

## ✨ Features

| Category | What It Does |
|----------|-------------|
| 💬 **Telegram Native** | Chat naturally — no clunky interfaces |
| 🧠 **Multi-Brain** | Swap between AI models on the fly via OpenRouter |
| 📁 **File Wizard** | Read, write, search, and organize files |
| 📧 **Email Butler** | Search, read, and send Gmail messages |
| 📅 **Calendar Boss** | Manage Google Calendar events |
| 💾 **Drive Access** | Full Google Drive integration |
| 🌐 **Web Explorer** | Fetch pages & search with Brave |
| ⏰ **Task Scheduler** | Set up cron jobs for recurring tasks |
| 🤖 **Subagents** | Spawn mini-agents for complex workflows |
| 🎭 **Personality Tweaks** | Make it professional, chaotic, or anything in between |

## 🚀 Quick Start

```bash
# Clone it
git clone https://github.com/brumaombra/picobot.git && cd picobot

# Install the goods
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

### Terminal

```bash
npm start          # 🚀 Launch the bot
npm run onboard    # 🧙 Setup wizard  
npm run status     # 📊 Check config
npm run nuke       # 💥 Reset everything
```

### Telegram

| Command | What It Does |
|---------|-------------|
| `/start` | Fresh conversation |
| `/model` | Switch AI models |
| `/models` | See available models |

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

## 🏗️ Project Structure

```
src/
├── 🤖 agent/       → The brain (conversation + tool execution)
├── 📬 bus/         → Message routing between components
├── 📱 channel/     → Telegram integration
├── ⌨️  cli/         → Command-line interface
├── ⚙️  config/      → Configuration management
├── 📄 files/       → Default prompt templates
├── ⏰ jobs/        → Cron job persistence
├── 🧠 llm/         → LLM provider abstraction
├── 💾 session/     → Conversation memory
├── 🔧 tools/       → All the cool integrations
└── 🛠️  utils/       → Helper functions
```

## 🎨 Make It Yours

Customize the personality by editing files in `~/.picobot/prompts/`:

| File | Controls |
|------|----------|
| `SOUL.md` | Personality, tone, communication style |
| `AGENTS.md` | How it approaches tasks |
| `TOOLS.md` | Tool usage preferences |

Want a sarcastic assistant? A formal one? A pirate? Just edit `SOUL.md` and restart.

---

<div align="center">

**Built with ☕ and questionable life choices**

[MIT License](LICENSE) • Made for humans who hate context-switching

</div>