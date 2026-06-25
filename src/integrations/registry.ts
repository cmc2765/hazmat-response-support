import type { IntegrationConfig } from "@/lib/schema";
import type { IntegrationMeta } from "./types";

type MetaListener = (metas: IntegrationMeta[]) => void;

class IntegrationRegistry {
  private metas = new Map<string, IntegrationMeta>();
  private listeners = new Set<MetaListener>();

  upsert(meta: IntegrationMeta): void {
    this.metas.set(meta.id, meta);
    this.notify();
  }

  remove(id: string): void {
    this.metas.delete(id);
    this.notify();
  }

  list(): IntegrationMeta[] {
    return [...this.metas.values()];
  }

  get(id: string): IntegrationMeta | undefined {
    return this.metas.get(id);
  }

  subscribe(l: MetaListener): () => void {
    this.listeners.add(l);
    l(this.list());
    return () => this.listeners.delete(l);
  }

  fromConfig(cfg: IntegrationConfig): IntegrationMeta {
    return {
      id: cfg.id,
      kind: cfg.kind,
      label: cfg.label,
      status: cfg.enabled ? "idle" : "disabled",
      lastSeenTs: cfg.lastSeenTs ?? null,
      lastError: cfg.lastError,
    };
  }

  private notify(): void {
    const snapshot = this.list();
    for (const l of this.listeners) {
      try {
        l(snapshot);
      } catch (err) {
        console.error("[registry] listener threw", err);
      }
    }
  }
}

export const integrationRegistry = new IntegrationRegistry();
