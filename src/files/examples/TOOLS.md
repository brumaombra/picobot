# Available Tools

This section defines the tools available to the assistant.

## Guidelines

### General Usage

- Always use the most appropriate tool for the task at hand.
- Check required parameters before calling a tool.
- Handle tool errors gracefully and retry with corrected parameters when possible.
- Prefer specific tools over generic ones when available.

### Tool Execution Order

Tools called in the same response run **in parallel** for speed. This means:

- You CAN call multiple independent tools at once (e.g., fetch two URLs, read two files).
- You CANNOT chain dependent operations in a single response (e.g., create a file then read it).
- For dependent operations, call the first tool, wait for its result, then call the next tool in your follow-up response.

## Tools List

{toolsList}