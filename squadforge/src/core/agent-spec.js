import { LEADER_SPEC_ID } from '../config.js';

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
    constructor({ id, name, description = '', model = null, allowedTools = [], prompt = '', filePath = null, metadata = {} } = {}) {
        if (!id) {
            throw new Error('AgentSpec requires an id.');
        }

        this.id = String(id);
        this.name = name ? String(name) : this.id;
        this.description = String(description || '');
        this.model = model ? String(model) : null;
        this.allowedTools = normalizeAllowedTools(allowedTools);
        this.prompt = String(prompt || '').trim();
        this.filePath = filePath ? String(filePath) : null;
        this.metadata = { ...metadata };
    }

    get isLeaderAgent() {
        return this.id === LEADER_SPEC_ID;
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
        name: merged.name || metadata.name,
        description: merged.description || metadata.description || '',
        model: merged.model || metadata.model || null,
        allowedTools: merged.allowedTools || metadata.allowed_tools || [],
        prompt: merged.prompt || merged.body || '',
        filePath: merged.filePath || null,
        metadata: merged.metadata
    });
};
