import type { IntegrationConfig, Observation, Reading } from "@/lib/schema";

export type IntegrationStatus = "idle" | "connecting" | "ok" | "stale" | "error" | "disabled";

export interface Integration<TPayload> {
  readonly kind: IntegrationConfig["kind"];
  connect(cfg: IntegrationConfig): Promise<void>;
  disconnect(): Promise<void>;
  status(): IntegrationStatus;
  lastSeen(): Date | null;
  subscribe(listener: (payload: TPayload) => void): () => void;
}

export interface WeatherIntegration extends Integration<Observation> {}
export interface SensorIntegration extends Integration<Reading> {}

export interface IntegrationMeta {
  id: string;
  kind: IntegrationConfig["kind"];
  label: string;
  status: IntegrationStatus;
  lastSeenTs: string | null;
  lastError?: string;
}

export type IntegrationEvent<T> = {
  integrationId: string;
  payload: T;
  receivedAt: string;
};
