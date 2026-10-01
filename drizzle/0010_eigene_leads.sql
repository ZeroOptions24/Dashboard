CREATE TABLE "app_setting" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "own_lead" (
	"id" text PRIMARY KEY NOT NULL,
	"setter_id" text,
	"status" text DEFAULT 'eingereicht' NOT NULL,
	"reason" text,
	"reason_note" text,
	"anrede" text,
	"vorname" text NOT NULL,
	"nachname" text NOT NULL,
	"telefon" text NOT NULL,
	"email" text,
	"strasse" text NOT NULL,
	"hausnummer" text NOT NULL,
	"plz" text NOT NULL,
	"ort" text NOT NULL,
	"themen" text DEFAULT '[]' NOT NULL,
	"entscheider" text,
	"rueckruf_datum" text,
	"rueckruf_uhrzeit" text,
	"zeitfenster" text DEFAULT '[]' NOT NULL,
	"notizen" text,
	"gps_lat" real,
	"gps_lon" real,
	"vq" text DEFAULT '{}' NOT NULL,
	"pd_person_id" integer,
	"pd_deal_id" integer,
	"synced_at" timestamp,
	"sync_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "own_lead" ADD CONSTRAINT "own_lead_setter_id_user_id_fk" FOREIGN KEY ("setter_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "own_lead_setter_idx" ON "own_lead" USING btree ("setter_id");--> statement-breakpoint
CREATE INDEX "own_lead_status_idx" ON "own_lead" USING btree ("status");