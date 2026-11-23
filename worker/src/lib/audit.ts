import { newId, nowIso } from "./ids.ts";

export interface AuditInput {
  gymId: string;
  actorId: string | null;
  action: string;
  entity: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
}

/** An audit row as a prepared statement, so it is written in the same batch (transaction) as the change itself. */
export function auditStatement(db: D1Database, input: AuditInput): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO audit_log (id, gym_id, actor_id, action, entity, entity_id, before_json, after_json, reason, at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      newId(),
      input.gymId,
      input.actorId,
      input.action,
      input.entity,
      input.entityId,
      input.before === undefined ? null : JSON.stringify(input.before),
      input.after === undefined ? null : JSON.stringify(input.after),
      input.reason ?? null,
      nowIso(),
    );
}
