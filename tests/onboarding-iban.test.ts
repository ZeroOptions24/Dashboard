import { describe, expect, it, vi } from "vitest";

/* Erstanmeldung: Die IBAN ist freiwillig, aber wenn angegeben, muss sie stimmen. */

vi.mock("@/server/db", async () => (await import("./db")).createTestDb());
vi.mock("@/server/auth", () => ({ auth: {} }));

const { validateFormData } = await import("@/server/onboarding");

const base = {
  telefon: "0171 1234567",
  geburtsdatum: "1990-05-01",
  strasse: "Teststraße 1",
  plz: "04109",
  ort: "Leipzig",
  iban: "",
  kontoinhaber: "",
  steuernummer: "",
  kleinunternehmer: false,
  gewerbeAngemeldet: false,
  datenschutz: true,
};

describe("Erstanmeldung – IBAN", () => {
  it("ist ohne IBAN (und ohne Kontoinhaber) vollständig", () => {
    expect(validateFormData(base)).toEqual({});
  });
  it("lehnt eine falsche IBAN weiterhin ab", () => {
    expect(validateFormData({ ...base, iban: "DE89 3704 0044 0532 0130 01", kontoinhaber: "Mia Muster" }).iban).toMatch(/ungültig/);
  });
  it("verlangt den Kontoinhaber nur, wenn eine IBAN angegeben ist", () => {
    expect(validateFormData({ ...base, iban: "DE89 3704 0044 0532 0130 00" }).kontoinhaber).toMatch(/fehlt/);
    expect(validateFormData({ ...base, iban: "DE89 3704 0044 0532 0130 00", kontoinhaber: "Mia Muster" })).toEqual({});
  });
});
