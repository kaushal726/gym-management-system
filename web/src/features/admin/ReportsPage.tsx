/* Reports (owner): collections for any date range, by mode and staff, trainer commission, and CSV downloads. */
import { useState } from "react";
import { FiDownload, FiFileText } from "react-icons/fi";
import type { CollectionsReport } from "../../../../shared/api.ts";
import { formatRupees } from "../../../../shared/money.ts";
import { formatDate, localMonthStart, localToday } from "../../lib/format.ts";
import { MODE_LABEL } from "../../lib/states.ts";
import { useApi } from "../../lib/useApi.ts";
import { ButtonLink } from "../../components/ui/Button.tsx";
import { TextField } from "../../components/ui/Field.tsx";
import { Badge, EmptyState, ErrorState, ListSkeleton } from "../../components/ui/Feedback.tsx";
import { useAdmin } from "./AdminShell.tsx";

export function ReportsPage() {
  const { gymId } = useAdmin();
  const [from, setFrom] = useState(localMonthStart);
  const [to, setTo] = useState(localToday);
  const range = `from=${from}&to=${to}`;
  const { data, error, loading, reload } = useApi<CollectionsReport>(from && to ? `/gyms/${gymId}/reports/collections?${range}` : null);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Reports</h1>
          <p>Money collected, by who and how.</p>
        </div>
        <div className="page-head__actions">
          <ButtonLink href={`/api/gyms/${gymId}/export/payments.csv?${range}`} external icon={<FiDownload />}>
            Payments CSV
          </ButtonLink>
          <ButtonLink href={`/api/gyms/${gymId}/export/members.csv`} external icon={<FiDownload />}>
            Members CSV
          </ButtonLink>
        </div>
      </div>

      <div className="form-grid form-grid--2" style={{ maxWidth: 480 }}>
        <TextField label="From" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
        <TextField label="To" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
      </div>

      {error && !data ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : loading && !data ? (
        <div className="card">
          <ListSkeleton rows={4} />
        </div>
      ) : (
        data && (
          <>
            <div className="stats">
              <div className="stat">
                <span className="stat__label">Collected</span>
                <span className="stat__value">{formatRupees(data.summary.totalPaise)}</span>
                <span className="stat__hint">{data.summary.count} entries</span>
              </div>
              {(Object.keys(MODE_LABEL) as (keyof typeof MODE_LABEL)[]).map((m) => (
                <div className="stat" key={m}>
                  <span className="stat__label">{MODE_LABEL[m]}</span>
                  <span className="stat__value">{formatRupees(data.summary.byMode[m])}</span>
                </div>
              ))}
            </div>

            <div className="two-col">
              <section className="section">
                <div className="section__head">
                  <span className="section__title">Entries</span>
                </div>
                <div className="card" style={{ overflowX: "auto" }}>
                  {data.payments.length === 0 ? (
                    <EmptyState icon={<FiFileText />} title="No payments in these dates" />
                  ) : (
                    <table className="table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Date</th>
                          <th>Member</th>
                          <th className="hide-mobile">By</th>
                          <th className="num">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.payments.map((p) => (
                          <tr key={p.id}>
                            <td className="tabular">{p.receiptNo}</td>
                            <td style={{ whiteSpace: "nowrap" }}>{formatDate(p.paidOn)}</td>
                            <td>
                              {p.memberName}
                              <div className="muted" style={{ fontSize: 12 }}>
                                {p.planName} · {MODE_LABEL[p.mode]}
                              </div>
                            </td>
                            <td className="hide-mobile">{p.collectedByName}</td>
                            <td className="num">
                              <span className={p.voidedAt ? "strike" : undefined}>{formatRupees(p.amountPaise)}</span>
                              {p.voidedAt && (
                                <div>
                                  <Badge tone="danger">Voided</Badge>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </section>

              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <section className="section">
                  <div className="section__head">
                    <span className="section__title">By staff</span>
                  </div>
                  <div className="card card--pad">
                    {data.summary.byStaff.length === 0 ? (
                      <p className="muted">No collections.</p>
                    ) : (
                      <dl className="kv">
                        {data.summary.byStaff.map((s) => (
                          <div key={s.name} style={{ display: "contents" }}>
                            <dt>{s.name}</dt>
                            <dd className="tabular">
                              {formatRupees(s.totalPaise)} · {s.count}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    )}
                  </div>
                </section>
                <section className="section">
                  <div className="section__head">
                    <span className="section__title">Trainer commission</span>
                  </div>
                  <div className="card card--pad">
                    {data.trainers.length === 0 ? (
                      <p className="muted" style={{ fontSize: 14 }}>
                        No personal-training payments in these dates.
                      </p>
                    ) : (
                      <dl className="kv">
                        {data.trainers.map((t) => (
                          <div key={t.trainerName} style={{ display: "contents" }}>
                            <dt>{t.trainerName}</dt>
                            <dd className="tabular">
                              {formatRupees(t.commissionPaise)} <span className="muted">of {formatRupees(t.collectedPaise)}</span>
                            </dd>
                          </div>
                        ))}
                      </dl>
                    )}
                  </div>
                </section>
              </div>
            </div>
          </>
        )
      )}
    </div>
  );
}
