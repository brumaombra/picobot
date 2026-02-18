---
name: research-report
description: Researches a topic on the web and produces a structured, well-cited report with key findings and source references.
---

# Research Report Skill

This skill produces a structured research report on any topic by delegating web research to the researcher subagent and compiling the findings into a clear, readable document.

## When to Use

Use this skill when the user asks for:

- A detailed report or summary on a topic
- Research into a subject with cited sources
- Fact-finding that requires gathering information from multiple web sources

## Workflow

### Step 1 — Clarify the Scope

Before starting, ensure you have the following information:

- The topic or question to research
- The desired depth (quick overview vs. comprehensive report)
- Any specific angles, sources, or time period to focus on

If any of these are missing and cannot be inferred from context, ask the user before proceeding.

### Step 2 — Delegate Web Research

Start a researcher subagent with a detailed prompt that includes:

- The topic to research
- The key questions to answer
- Instructions to return a list of findings with source URLs
- Instructions to cross-reference at least 3 independent sources

### Step 3 — Review and Compile

When the researcher subagent returns its results:

- Review the findings for completeness and accuracy
- If the results are thin or insufficient, send the subagent back for another pass with more refined queries
- Compile the findings into a structured report with the following sections:
  1. **Summary** — A concise overview of the topic (2–3 sentences)
  2. **Key Findings** — Bullet points of the most important facts or insights
  3. **Details** — Expanded information organized by subtopic or theme
  4. **Sources** — Full list of cited URLs with brief descriptions

### Step 4 — Deliver to User

Present the compiled report to the user in a clear, readable format. Do not use tables — use headings, bullet points, and short paragraphs.

## Notes

- Prefer authoritative, recent, and well-known sources.
- Do not fabricate or infer information not found during research — if a fact cannot be verified, say so.
- For time-sensitive topics, include the research date in the report.
- If the researcher subagent is not available, use the `web_search` and `web_fetch` tools directly to gather information.