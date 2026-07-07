-- Runs once when the postgres volume is empty (initdb).
-- The seed migration (003_seed_data.sql) has a guard that refuses to run
-- unless app.env is something other than 'production'.
ALTER DATABASE blackfyre SET app.env = 'development';
