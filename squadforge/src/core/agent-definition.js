const MAIN_AGENT_KIND = 'main';
const SUBAGENT_KIND = 'subagent';

const normalizeAllowedTools = value => {
    if (!value) {
        return [];
    }

    if (Array.isArray(value)) {
        return value.map(item => String(item).trim()).filter(Boolean);
    }

    return [String(value).trim()].filter(Boolean);
};

export class AgentDefinition {
    constructor({ id, kind = SUBAGENT_KIND, name, description = '', model = null, allowedTools = [], prompt = '', filePath = null, metadata = {} } = {}) {
        if (!id) {
            throw new Error('AgentDefinition requires an id.');
        }

        if (kind !== MAIN_AGENT_KIND && kind !== SUBAGENT_KIND) {
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

    get isMainAgent() {
        return this.kind === MAIN_AGENT_KIND;
    }
}

export const normalizeAgentDefinition = (rawDefinition = {}, overrides = {}) => {
    const metadata = rawDefinition.metadata || {};
    const merged = {
        ...rawDefinition,
        ...overrides,
        metadata: {
            ...metadata,
            ...(overrides.metadata || {})
        }
    };

    return new AgentDefinition({
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

export { MAIN_AGENT_KIND, SUBAGENT_KIND };
