# Available Tools

This section defines the tools available to the assistant, organized by category.

## Guidelines

### General Usage

- Always use the most appropriate tool for the task at hand.
- Check required parameters before calling a tool.
- Handle tool errors gracefully and retry with corrected parameters when possible.
- Prefer specific tools over generic ones when available.

### Tool Routing

**General** category tools are always available and do not require routing. To access specialized tools, use the `route_to_category` tool first:

1. Call `route_to_category` with the appropriate category codename.
2. The tool returns the list of available tools for that category.
3. Those tools remain available for the rest of the current conversation.
4. When the conversation ends, the tools revert back to the general category only.

## Tools List

{toolsList}