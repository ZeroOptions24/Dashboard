CREATE TABLE "academy_progress" (
	"user_id" text NOT NULL,
	"module_id" text NOT NULL,
	"done_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "academy_progress_user_id_module_id_pk" PRIMARY KEY("user_id","module_id")
);
--> statement-breakpoint
CREATE TABLE "academy_role" (
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"status" text NOT NULL,
	"via" text DEFAULT 'test' NOT NULL,
	"score" integer,
	"total" integer,
	"tries" integer DEFAULT 0 NOT NULL,
	"retry" boolean DEFAULT false NOT NULL,
	"passed_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "academy_role_user_id_role_pk" PRIMARY KEY("user_id","role")
);
--> statement-breakpoint
CREATE TABLE "academy_video" (
	"module_id" text PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "academy_progress" ADD CONSTRAINT "academy_progress_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academy_role" ADD CONSTRAINT "academy_role_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Bestandsschutz: Wer beim Einführen der Akademie schon im Team ist, bleibt für seine Rollen freigeschaltet.
-- Neu eingeladene MAs und später dazugekommene Rollen müssen durch die Akademie.
INSERT INTO "academy_role" ("user_id", "role", "status", "via", "passed_at")
SELECT u."id", r."role", 'bestanden', 'bestand', now()
FROM "user" u
CROSS JOIN (VALUES ('setter'), ('presetter'), ('closer')) AS r("role")
WHERE ',' || replace(coalesce(u."role", ''), ' ', '') || ',' LIKE '%,' || r."role" || ',%'
ON CONFLICT DO NOTHING;
