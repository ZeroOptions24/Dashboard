import "server-only";
import { eq } from "drizzle-orm";
import { formatIban } from "@/lib/iban";
import { decrypt } from "./crypto";
import { db, schema } from "./db";

/* Überweisungsliste für die Bank (CSV, Semikolon, für Excel): alle freigegebenen Abrechnungen mit IBAN.
   Enthält Bankdaten – nur für Admins, jeder Abruf wird im Protokoll festgehalten. */

const q = (s: unknown) => `"${String(s ?? "").replace(/"/g, '""')}"`;
const csv = (rows: unknown[][]) => "﻿" + rows.map((r) => r.map(q).join(";")).join("\r\n");
const betrag = (n: number) => n.toFixed(2).replace(".", ",");

export async function exportTransfers(adminId: string) {
  const rows = await db
    .select({ p: schema.payout, name: schema.user.name, iban: schema.profile.ibanEnc, inhaber: schema.profile.kontoinhaber })
    .from(schema.payout)
    .innerJoin(schema.user, eq(schema.user.id, schema.payout.userId))
    .leftJoin(schema.profile, eq(schema.profile.userId, schema.payout.userId))
    .where(eq(schema.payout.status, "freigegeben"));
  const list = rows
    .filter((r) => r.iban)
    .sort((a, b) => a.p.datum.split(".").reverse().join("").localeCompare(b.p.datum.split(".").reverse().join("")) || a.name.localeCompare(b.name, "de"));
  await db.insert(schema.auditLog).values({ actorId: adminId, action: "payout.export", detail: `Überweisungsliste: ${list.length} Abrechnungen, ${rows.length - list.length} ohne IBAN` });
  return csv([
    ["Empfänger", "IBAN", "Betrag (EUR)", "Verwendungszweck", "Auszahlung am", "Abrechnung"],
    ...list.map((r) => [r.inhaber || r.name, formatIban(decrypt(r.iban!)), betrag(r.p.betrag), `Gutschrift ${r.p.id} ${r.p.periode}`, r.p.datum, r.p.id]),
  ]);
}
