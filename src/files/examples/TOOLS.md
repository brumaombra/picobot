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
3. Those tools become available for subsequent calls in the conversation.

### Best Practices

- **File Operations**: Use `read_file` and `write_file` for direct file manipulation. Use `shell` for complex operations like batch processing.
- **Web Fetching**: Content is automatically cleaned (HTML stripped, JSON formatted). Large responses are truncated.
- **Shell Commands**: Dangerous commands are blocked. Prefer file tools when applicable.
- **Cron Jobs**: Jobs persist across restarts. Use descriptive names for easy management.
- **Category Routing**: Route to specialized categories only when needed for the current task.

## Tools List

{toolsList}