import { isLeaderAgent } from '../utils/utils.js';

/******************************* Create the system prompts parts *******************************/

// Create the agent markdown prompt part
const createAgentPromptPart = ({ agent }) => {
    return (agent.definition.prompt || '').trim();
};

// Create the shared subagents prompt fragment for the leader
const createSubagentsPromptPart = ({ runtime, promptTemplates }) => {
    // Create a bulleted list of subagents available to the leader
    const subagentSpecs = [...runtime.agentsSpecs.values()].filter(spec => !isLeaderAgent(spec.id));
    const subagentsList = subagentSpecs.length === 0
        ? 'No specialized agents available.'
        : subagentSpecs.map(spec => `- ${spec.id}: ${spec.description || spec.name}`).join('\n');

    // Inject the subagents list into the prompt template
    return (promptTemplates?.subagents || '')
        .replace('{subagentsList}', subagentsList)
        .trim();
};

// Create the shared tools prompt fragment
const createToolsPromptPart = ({ agent, promptTemplates }) => {
    // Create a bulleted list of tools available to the agent
    const tools = agent.listTools();
    const toolsList = tools.length === 0
        ? 'No tools available.'
        : tools.map(tool => `- ${tool.name}: ${tool.description}`).join('\n');

    // Inject the tools list into the prompt template
    return (promptTemplates?.tools || '')
        .replace('{toolsList}', toolsList)
        .trim();
};

// Create the shared skills prompt fragment
const createSkillsPromptPart = ({ runtime, promptTemplates }) => {
    // Create a formatted list of available skills
    const skills = [...runtime.skills.values()];
    const skillsList = skills.length === 0
        ? 'No skills available.'
        : skills.map(skill => [
            `### ${skill.name}`,
            `- Description: ${skill.description || 'No description provided.'}`,
            `- Path: ${skill.filePath}`
        ].join('\n')).join('\n\n');

    // Inject the skills list into the prompt template
    return (promptTemplates?.skills || '')
        .replace('{skillsList}', skillsList)
        .trim();
};

// Create the shared subagent prompt fragment
const createSubagentPromptPart = ({ promptTemplates }) => {
    return (promptTemplates?.subagent || '').trim();
};

/******************************* Compose the system prompts (For the leader and the various subagents) *******************************/

// Compose the leader system prompt
const composeLeaderSystemPrompt = ({ runtime, agent, promptTemplates }) => {
    return [
        createAgentPromptPart({ agent }),
        createSubagentsPromptPart({ runtime, promptTemplates }),
        createToolsPromptPart({ agent, promptTemplates }),
        createSkillsPromptPart({ runtime, promptTemplates })
    ].filter(Boolean).join('\n\n');
};

// Compose a subagent system prompt
const composeSubagentSystemPrompt = ({ agent, promptTemplates }) => {
    return [
        createSubagentPromptPart({ promptTemplates }),
        createAgentPromptPart({ agent }),
        createToolsPromptPart({ agent, promptTemplates })
    ].filter(Boolean).join('\n\n');
};

// Compose the final prompt for an agent
export const composeAgentPrompt = ({ runtime, agent, promptTemplates }) => {
    // Check the agent type
    if (isLeaderAgent(agent.definition.id)) {
        return composeLeaderSystemPrompt({ runtime, agent, promptTemplates }); // Compose the leader
    } else {
        return composeSubagentSystemPrompt({ agent, promptTemplates }); // Compose the subagent prompt
    }
};