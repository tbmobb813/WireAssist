'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.MCPClient = void 0;
class MCPClient {
  constructor() {
    Object.defineProperty(this, 'tools', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: new Map(),
    });
  }
  register(name, handler) {
    this.tools.set(name, handler);
  }
  async call(name, params) {
    const handler = this.tools.get(name);
    if (!handler) {
      throw new Error(`MCP tool not registered: ${name}`);
    }
    return handler(params);
  }
  listTools() {
    return Array.from(this.tools.keys());
  }
}
exports.MCPClient = MCPClient;
