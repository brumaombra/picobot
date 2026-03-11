---
name: research-report
description: Researches a topic and produces a structured report with key findings and source references.
---

# Research Report Skill

This skill produces a structured research report on any topic by delegating research to the appropriate specialist subagent and compiling the findings into a clear, readable document.

## When to Use

Use this skill when the user asks for:

- A detailed report or summary on a topic
- Research into a subject with cited sources
- Fact-finding that requires gathering information from multiple sources

## Workflow

### Step 1 - Clarify the Scope

Before starting, ensure you have the following information:

- The topic or question to research
- The desired depth
- Any specific angles, sources, or time period to focus on

If any of these are missing and cannot be inferred from context, ask the user before proceeding.

### Step 2 - Delegate Research

Start the most appropriate subagent with a detailed prompt that includes:

- The topic to research
- The key questions to answer
- Instructions to return a list of findings with source references
- Instructions to cross-check important facts

### Step 3 - Review and Compile

When the subagent returns its results:

- Review the findings for completeness and accuracy
- If the results are thin or insufficient, send the subagent back for another pass with more refined instructions
- Compile the findings into a structured report with summary, key findings, details, and sources

### Step 4 - Deliver to User

Present the compiled report to the user in a clear, readable format. Do not use tables unless the user explicitly asks for one.

## Notes

- Prefer authoritative, recent, and well-known sources.
- Do not fabricate or infer information that was not actually found during research.
- For time-sensitive topics, include the research date in the report.