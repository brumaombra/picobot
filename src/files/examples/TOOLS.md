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
3. Those tools become available for the **next iteration only** - use them immediately.
4. After one iteration, the tools revert back to the general category only.

**Important**: Plan your tool usage before routing. Once you route to a category, call all needed tools from that category in the same turn. If you need to use the category tools again later, you must call `route_to_category` again.

## Tools List

{toolsList}