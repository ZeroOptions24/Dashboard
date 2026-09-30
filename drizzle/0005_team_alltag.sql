CREATE TABLE "appointment" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text NOT NULL,
	"closer_id" text NOT NULL,
	"kind" text NOT NULL,
	"date" text NOT NULL,
	"start" real NOT NULL,
	"dur" real DEFAULT 1.5 NOT NULL,
	"ort" text DEFAULT '' NOT NULL,
	"kunde" text,
	"feedback_result" text,
	"feedback_note" text,
	"feedback_at" timestamp,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "board" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"unit" text NOT NULL,
	"goal" integer,
	"ends" text NOT NULL,
	"rows" text DEFAULT '[]' NOT NULL,
	"prizes" text DEFAULT '[]' NOT NULL,
	"marks" text DEFAULT '[]' NOT NULL,
	"published_at" timestamp,
	"published_by" text,
	"archived_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "closer_slot" (
	"id" text PRIMARY KEY NOT NULL,
	"closer_id" text NOT NULL,
	"date" text NOT NULL,
	"start" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_rsvp" (
	"event_id" text NOT NULL,
	"user_id" text NOT NULL,
	CONSTRAINT "event_rsvp_event_id_user_id_pk" PRIMARY KEY("event_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "notification" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "notification_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" text NOT NULL,
	"text" text NOT NULL,
	"status" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"read_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "payout" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"periode" text NOT NULL,
	"betrag" integer NOT NULL,
	"status" text DEFAULT 'pruefung' NOT NULL,
	"datum" text NOT NULL,
	"posten" text DEFAULT '[]' NOT NULL,
	"released_by" text,
	"released_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_event" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"date" text NOT NULL,
	"time" text NOT NULL,
	"ort" text NOT NULL,
	"type" text NOT NULL,
	"target" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "money_goal" integer;--> statement-breakpoint
ALTER TABLE "appointment" ADD CONSTRAINT "appointment_closer_id_user_id_fk" FOREIGN KEY ("closer_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment" ADD CONSTRAINT "appointment_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board" ADD CONSTRAINT "board_published_by_user_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "closer_slot" ADD CONSTRAINT "closer_slot_closer_id_user_id_fk" FOREIGN KEY ("closer_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_rsvp" ADD CONSTRAINT "event_rsvp_event_id_team_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."team_event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_rsvp" ADD CONSTRAINT "event_rsvp_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout" ADD CONSTRAINT "payout_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout" ADD CONSTRAINT "payout_released_by_user_id_fk" FOREIGN KEY ("released_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_event" ADD CONSTRAINT "team_event_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "appointment_closer_idx" ON "appointment" USING btree ("closer_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "closer_slot_unique" ON "closer_slot" USING btree ("closer_id","date","start");--> statement-breakpoint
CREATE INDEX "notification_user_idx" ON "notification" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "payout_user_idx" ON "payout" USING btree ("user_id");