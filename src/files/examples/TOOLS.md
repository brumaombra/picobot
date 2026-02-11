# Available Tools

This section defines the tools available to the assistant, organized by category.

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

### Tool Usage Tips

- Always use the `get_datetime` tool to get the current date or time, which is more than enough. NEVER use the `date` shell command for that.

### Tool Routing

**General** tools are always available by default.

To access specialized tools, use the `route_to_category` tool:

1. Call `route_to_category` with a category name.
2. The specified category tools become available for subsequent tool calls within the current response.
3. You can route to multiple categories.
4. General tools always remain available regardless of routing.
5. Route to the needed category BEFORE attempting to use its tools in the same response.

## Tools List

{toolsList}