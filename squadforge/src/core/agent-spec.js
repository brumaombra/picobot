// AgentSpec class
export class AgentSpec {
    // Constructor
    constructor({ id, name, description = '', model = null, allowedTools = [], prompt = '', filePath = null, metadata = {} } = {}) {
        // Validate the id
        if (!id) {
            throw new Error('AgentSpec requires an id.');
        }

        // Save the properties
        this.id = id;
        this.name = name || this.id;
        this.description = description;
        this.model = model;
        this.allowedTools = allowedTools;
        this.prompt = prompt;
        this.filePath = filePath;
        this.metadata = { ...metadata };
    }
}