/** Echte Daten (Pipedrive + Datenbank) statt Beispieldaten – NEXT_PUBLIC_DATA_SOURCE=pipedrive.
 *  Eigenes Modul ohne React, damit es auch in Code nutzbar ist, der auf dem Server läuft. */
export const LIVE = process.env.NEXT_PUBLIC_DATA_SOURCE === "pipedrive" || process.env.NEXT_PUBLIC_DATA_SOURCE === "live";
