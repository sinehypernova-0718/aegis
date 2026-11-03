-- Match cursor serialization (canonical ISO timestamps have millisecond precision).
ALTER TABLE "vault_records"
	ALTER COLUMN "created_at" TYPE timestamptz(3)
	USING date_trunc('milliseconds', "created_at");

CREATE INDEX "vault_records_vault_created_id_idx"
	ON "vault_records" USING btree ("vault_id", "created_at" DESC, "id" DESC);
