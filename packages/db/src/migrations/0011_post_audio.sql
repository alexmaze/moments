ALTER TABLE "posts"
ADD COLUMN "audio_url" text,
ADD COLUMN "audio_duration_secs" integer,
ADD COLUMN "audio_waveform" text,
ADD COLUMN "audio_mime_type" text,
ADD COLUMN "audio_size_bytes" integer;
