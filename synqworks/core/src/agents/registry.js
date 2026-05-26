"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentRegistry = void 0;
class AgentRegistry {
    constructor() {
        Object.defineProperty(this, "agents", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
    }
    register(agent) {
        this.agents.set(agent.role, agent);
    }
    get(role) {
        return this.agents.get(role);
    }
    all() {
        return Array.from(this.agents.values());
    }
}
exports.AgentRegistry = AgentRegistry;
