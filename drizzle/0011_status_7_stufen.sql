-- Pipeline mit 7 Stufen (Tims Ablauf, 03.10.2026): „termin“ heißt jetzt „aufmass“,
-- angerufene, aber noch offene eigene Leads stehen in „terminierung“.
UPDATE "own_lead" SET "status" = 'aufmass' WHERE "status" = 'termin';--> statement-breakpoint
UPDATE "own_lead" SET "status" = 'terminierung' WHERE "status" = 'eingereicht' AND "id" IN (SELECT "lead_id" FROM "lead_activity" WHERE "kind" IN ('attempt', 'callback'));--> statement-breakpoint
UPDATE "lead_activity" SET "data" = replace("data", '"status":"termin"', '"status":"aufmass"') WHERE "kind" = 'status' AND "data" LIKE '%"status":"termin"%';--> statement-breakpoint
UPDATE "notification" SET "status" = 'aufmass' WHERE "status" = 'termin';
