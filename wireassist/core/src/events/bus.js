'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.EventBus = void 0;
class EventBus {
  constructor() {
    Object.defineProperty(this, 'handlers', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: new Map(),
    });
  }
  on(event, handler) {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, []);
    }
    this.handlers.get(event).push(handler);
  }
  emit(event, payload) {
    this.handlers.get(event)?.forEach((h) => h(payload));
  }
  off(event, handler) {
    const list = this.handlers.get(event) ?? [];
    this.handlers.set(
      event,
      list.filter((h) => h !== handler)
    );
  }
}
exports.EventBus = EventBus;
