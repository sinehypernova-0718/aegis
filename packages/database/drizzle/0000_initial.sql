CREATE TABLE "vaults" (
	"id" uuid PRIMARY KEY NOT NULL,
	"status" text NOT NULL,
	"encryption_format_version" integer NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);

CREATE INDEX "vaults_status_idx" ON "vaults" USING btree ("status");

CREATE TABLE "vault_key_envelopes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"vault_id" uuid NOT NULL,
	"purpose" text NOT NULL,
	"envelope_version" integer NOT NULL,
	"envelope" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"rotated_at" timestamp with time zone,
	"revoked_at" timestamp with time zone
);

CREATE INDEX "vault_key_envelopes_vault_id_idx" ON "vault_key_envelopes" USING btree ("vault_id");
CREATE UNIQUE INDEX "vault_key_envelopes_active_purpose_idx" ON "vault_key_envelopes" USING btree ("vault_id","purpose") WHERE revoked_at is null;

ALTER TABLE "vault_key_envelopes" ADD CONSTRAINT "vault_key_envelopes_vault_id_fk" FOREIGN KEY ("vault_id") REFERENCES "public"."vaults"("id") ON DELETE cascade ON UPDATE no action;

CREATE TABLE "vault_records" (
	"id" uuid PRIMARY KEY NOT NULL,
	"vault_id" uuid NOT NULL,
	"record_type" text NOT NULL,
	"encryption_version" integer NOT NULL,
	"nonce" bytea NOT NULL,
	"ciphertext" bytea NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone
);

CREATE INDEX "vault_records_vault_id_idx" ON "vault_records" USING btree ("vault_id");
CREATE INDEX "vault_records_vault_type_idx" ON "vault_records" USING btree ("vault_id","record_type");
CREATE INDEX "vault_records_created_at_idx" ON "vault_records" USING btree ("created_at");

ALTER TABLE "vault_records" ADD CONSTRAINT "vault_records_vault_id_fk" FOREIGN KEY ("vault_id") REFERENCES "public"."vaults"("id") ON DELETE cascade ON UPDATE no action;
