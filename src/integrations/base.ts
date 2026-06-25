import type { Integration, IntegrationStatus } from "./types";

type Listener<T> = (payload: T) => void;

export class BaseIntegration<TPayload> implements Integration<TPayload> {
  protected listeners = new Set<Listener<TPayload>>();
  protected _status: IntegrationStatus = "idle";
  protected _lastSeen: Date | null = null;
  protected _lastError: string | undefined = undefined;
  protected cfg: import("@/lib/schema").IntegrationConfig | null = null;

  constructor(public readonly kind: import("@/lib/schema").IntegrationConfig["kind"]) {}

  status(): IntegrationStatus {
    return this._status;
  }

  lastSeen(): Date | null {
    return this._lastSeen;
  }

  subscribe(listener: (payload: TPayload) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  protected emit(payload: TPayload): void {
    this._lastSeen = new Date();
    this._lastError = undefined;
    this._status = "ok";
    for (const l of this.listeners) {
      try {
        l(payload);
      } catch (err) {
        console.error("[integration] listener threw", err);
      }
    }
  }

  protected setError(message: string): void {
    this._lastError = message;
    this._status = "error";
  }

  connect(_cfg: import("@/lib/schema").IntegrationConfig): Promise<void> {
    this.cfg = _cfg;
    this._status = "connecting";
    return Promise.resolve();
  }

  disconnect(): Promise<void> {
    this.cfg = null;
    this.listeners.clear();
    this._status = "idle";
    return Promise.resolve();
  }
}
