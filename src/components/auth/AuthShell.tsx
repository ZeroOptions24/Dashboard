import type { ReactNode } from "react";

/** Rahmen für Login-, Passwort- und Onboarding-Seiten. */
export default function AuthShell({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="ee-auth">
      <div className={wide ? "ee-auth__box ee-auth__box--wide" : "ee-auth__box"}>
        <div className="ee-auth__brand">
          <div className="ee-brand__mark" aria-hidden="true">
            E
          </div>
          <div>
            <div className="ee-brand__name">
              Energy<span>Engel</span>
            </div>
            <div className="ee-brand__sub" style={{ color: "var(--ink-3)" }}>
              MB-Dashboard
            </div>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
