"use client";

import Icon from "@/components/ui/Icon";
import { fieldVisible, type FieldDef, type FormValues } from "@/lib/vq";

/** Formularfeld aus einer FieldDef (Lead erfassen, Vorqualifizierung, Leitfaden).
 *  scope macht IDs eindeutig, wenn dieselbe Frage mehrfach auf der Seite steht. */
export default function Field({
  f,
  values,
  onChange,
  scope,
  error,
}: {
  f: FieldDef;
  values: FormValues;
  onChange: (name: string, value: string | string[]) => void;
  scope: string;
  error?: string;
}) {
  const v = values[f.n];
  const id = `${scope}-${f.n}`;
  const hidden = !fieldVisible(f, values);
  const cls = ["ee-field", f.half ? "" : "ee-field--full", f.showIf ? "ee-cond" : ""];
  const tags = (
    <>
      {f.req && <span className="ee-ftag ee-ftag--req">Pflicht</span>}
      {f.heat && <span className="ee-ftag ee-ftag--heat">Heizlast</span>}
      {f.ko && <span className="ee-ftag ee-ftag--ko">K.-o.-Kriterium</span>}
    </>
  );
  const hint = (
    <>
      {f.hint && <span className="ee-hint">{f.hint}</span>}
      {f.sensitive && (
        <span className="ee-secure">
          <Icon name="lock" /> vertraulich
        </span>
      )}
      {error && <span className="ee-hint ee-hint--err">{error}</span>}
    </>
  );

  if (f.t === "radio" || f.t === "check") {
    const multi = f.t === "check";
    const list = Array.isArray(v) ? v : [];
    return (
      <fieldset className={[...cls, error ? "is-invalid" : ""].filter(Boolean).join(" ")} hidden={hidden} data-field={f.n}>
        <legend className="lbl">
          {f.l} {tags}
        </legend>
        <div className={f.cols ? "ee-opts ee-opts--cols" : "ee-opts"}>
          {f.o!.map((o) => (
            <label key={o} className="ee-opt">
              <input
                type={multi ? "checkbox" : "radio"}
                name={`${scope}-${f.n}`}
                value={o}
                checked={multi ? list.includes(o) : v === o}
                onChange={(e) => onChange(f.n, multi ? (e.target.checked ? [...list, o] : list.filter((x) => x !== o)) : o)}
              />
              <span>{o}</span>
            </label>
          ))}
        </div>
        {hint}
      </fieldset>
    );
  }

  const value = typeof v === "string" ? v : "";
  let ctrl: React.ReactNode;
  if (f.t === "select")
    ctrl = (
      <select className="ee-select" id={id} name={f.n} value={value} onChange={(e) => onChange(f.n, e.target.value)}>
        <option value="">Bitte wählen</option>
        {f.o!.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    );
  else if (f.t === "textarea")
    ctrl = <textarea className="ee-textarea" id={id} name={f.n} placeholder={f.ph || ""} value={value} onChange={(e) => onChange(f.n, e.target.value)} />;
  else
    ctrl = (
      <input
        className={error ? "ee-input is-invalid" : "ee-input"}
        id={id}
        name={f.n}
        type={f.t}
        step={f.step}
        inputMode={f.im}
        maxLength={f.max}
        autoComplete={f.ac}
        placeholder={f.ph || ""}
        value={value}
        onChange={(e) => onChange(f.n, e.target.value)}
      />
    );
  return (
    <div className={cls.filter(Boolean).join(" ")} hidden={hidden} data-field={f.n}>
      <label htmlFor={id}>
        {f.l} {tags}
      </label>
      {ctrl}
      {hint}
    </div>
  );
}
