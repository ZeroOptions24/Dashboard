import { desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db, schema } from "@/server/db";

export const metadata = { title: "Test-Postfach · EnergyEngel" };
export const dynamic = "force-dynamic";

/* Nur Entwicklung: zeigt alle E-Mails, die das System verschickt hätte (Tabelle outbox). */
export default async function DevMailbox() {
  if (process.env.NODE_ENV !== "development") notFound();
  const mails = await db.select().from(schema.outbox).orderBy(desc(schema.outbox.id)).limit(30);
  return (
    <main className="ee-content" style={{ margin: "0 auto" }}>
      <div className="ee-pagehead">
        <h1>Test-Postfach</h1>
      </div>
      <div className="ee-dev-banner">Entwicklungsmodus: Ohne SMTP-Zugang werden E-Mails nicht verschickt, sondern nur hier angezeigt.</div>
      {mails.length === 0 && <div className="ee-empty">Noch keine E-Mails.</div>}
      {mails.map((m) => (
        <article key={m.id} className="ee-mail">
          <div className="ee-mail__head">
            <b>{m.subject}</b>
            <span className="muted">an {m.to}</span>
            <span className="faint">{m.createdAt.toLocaleString("de-DE")}</span>
            {m.sentAt ? <span className="ee-chip ee-chip--ok">verschickt</span> : <span className="ee-chip">nur lokal</span>}
          </div>
          <iframe title={m.subject} srcDoc={m.html} sandbox="allow-top-navigation-by-user-activation allow-popups" />
        </article>
      ))}
    </main>
  );
}
