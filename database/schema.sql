-- Enable PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- Incidents table
CREATE TABLE IF NOT EXISTS incidents (
    id SERIAL PRIMARY KEY,
    category VARCHAR(50) NOT NULL,        -- waterlogging / pothole / fallen_tree / other
    description TEXT,
    photo_url TEXT,
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    h3_index VARCHAR(20),                 -- H3 cell for fast filtering
    status VARCHAR(20) DEFAULT 'pending', -- pending / verified / resolved
    reported_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Officer-drawn zones (for IPI scoring)
CREATE TABLE IF NOT EXISTS zones (
    id SERIAL PRIMARY KEY,
    polygon GEOGRAPHY(POLYGON, 4326) NOT NULL,
    ipi_score FLOAT,
    created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_incidents_location ON incidents USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_incidents_h3 ON incidents (h3_index);