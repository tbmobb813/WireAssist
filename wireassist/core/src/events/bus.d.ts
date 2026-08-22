type EventHandler = (payload: unknown) => void;
export declare class EventBus {
  private handlers;
  on(event: string, handler: EventHandler): void;
  emit(event: string, payload: unknown): void;
  off(event: string, handler: EventHandler): void;
}
export {};
//# sourceMappingURL=bus.d.ts.map
