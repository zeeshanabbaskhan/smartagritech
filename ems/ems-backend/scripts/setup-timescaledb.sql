-- TimescaleDB setup for SmartAgriTech EMS (P-33)
-- Requires: CREATE EXTENSION timescaledb; (run install-timescaledb.ps1 first)

-- TimescaleDB requires the partition column in unique/PK constraints
ALTER TABLE sensor_readings DROP CONSTRAINT IF EXISTS sensor_readings_pkey;

SELECT create_hypertable(
  'sensor_readings',
  by_range('timestamp'),
  if_not_exists => TRUE,
  migrate_data  => TRUE
);

ALTER TABLE sensor_readings ADD PRIMARY KEY (id, timestamp);

-- Enable native compression on older chunks
ALTER TABLE sensor_readings SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = '"deviceId"'
);

SELECT add_compression_policy('sensor_readings', INTERVAL '7 days', if_not_exists => TRUE);

-- Drop raw readings older than 90 days
SELECT add_retention_policy('sensor_readings', INTERVAL '90 days', if_not_exists => TRUE);

-- Hourly continuous aggregate for dashboard rollups
CREATE MATERIALIZED VIEW IF NOT EXISTS sensor_readings_hourly
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 hour', sr."timestamp") AS bucket,
  sr."deviceId",
  elem->>'variableName' AS variable_name,
  AVG((elem->>'value')::double precision) AS avg_value
FROM sensor_readings sr,
     jsonb_array_elements(sr.readings::jsonb) AS elem
GROUP BY bucket, sr."deviceId", variable_name
WITH NO DATA;

SELECT add_continuous_aggregate_policy(
  'sensor_readings_hourly',
  start_offset      => INTERVAL '3 hours',
  end_offset        => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour',
  if_not_exists     => TRUE
);
