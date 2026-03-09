import { LEADER_AGENT_KIND, SUBAGENT_KIND } from '../config.js';

const normalizeAllowedTools = value => {
    if (!value) {
        return [];
    }

    if (Array.isArray(value)) {
        return value.map(item => String(item).trim()).filter(Boolean);
    }

    return [String(value).trim()].filter(Boolean);
};

export class AgentSpec {
    constructor({ id, kind = SUBAGENT_KIND, name, description = '', model = null, allowedTools = [], prompt = '', filePath = null, metadata = {} } = {}) {
        if (!id) {
            throw new Error('AgentSpec requires an id.');
        }

        if (kind !== LEADER_AGENT_KIND && kind !== SUBAGENT_KIND) {
            throw new Error(`Unsupported agent kind "${kind}".`);
        }

        this.id = String(id);
        this.kind = kind;
        this.name = name ? String(name) : this.id;
        this.description = String(description || '');
        this.model = model ? String(model) : null;
        this.allowedTools = normalizeAllowedTools(allowedTools);
        this.prompt = String(prompt || '').trim();
        this.filePath = filePath ? String(filePath) : null;
        this.metadata = { ...metadata };
    }

    get isLeaderAgent() {
        return this.kind === LEADER_AGENT_KIND;
    }
}

export const normalizeAgentSpec = (rawSpec = {}, overrides = {}) => {
    const metadata = rawSpec.metadata || {};
    const merged = {
        ...rawSpec,
        ...overrides,
        metadata: {
            ...metadata,
            ...(overrides.metadata || {})
        }
    };

    return new AgentSpec({
        id: merged.id,
        kind: merged.kind,
        name: merged.name || metadata.name,
        description: merged.description || metadata.description || '',
        model: merged.model || metadata.model || null,
        allowedTools: merged.allowedTools || metadata.allowed_tools || [],
        prompt: merged.prompt || merged.body || '',
        filePath: merged.filePath || null,
        metadata: merged.metadata
    });
};

export { LEADER_AGENT_KIND, SUBAGENT_KIND };