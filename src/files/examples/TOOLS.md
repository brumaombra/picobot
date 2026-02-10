# Available Tools

This section defines the tools available to the assistant, organized by category.

## Guidelines

### General Usage

- Always use the most appropriate tool for the task at hand.
- Check required parameters before calling a tool.
- Handle tool errors gracefully and retry with corrected parameters when possible.
- Prefer specific tools over generic ones when available.

### Tool Execution Order

Tools run one after another in the order you call them, allowing you to chain operations that depend on each other in a single batch call. For example, create a file, then immediately read or modify it with subsequent tool calls in the same response.

### Tool Usage Tips

- Always use the `get_datetime` tool to get the current date or time, NEVER use the shell for that.

### Tool Routing

**General** tools are always available by default.

To access specialized tools, use the `route_to_category` tool:

1. Call `route_to_category` with a category name.
2. The specified category tools are added to your available tools.
3. Those tools remain available for the rest of the current conversation.
4. You can route to multiple categories in the same conversation.
5. General tools always remain available regardless of routing.

## Tools List

{toolsList}