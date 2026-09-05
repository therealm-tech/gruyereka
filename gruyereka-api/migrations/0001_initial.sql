CREATE TYPE milk_type AS ENUM ('cow', 'goat', 'sheep', 'buffalo');

CREATE TYPE paste_type AS ENUM (
    'fresh',
    'soft_bloomy_rind',
    'soft_washed_rind',
    'pressed_uncooked',
    'pressed_cooked',
    'blue_veined',
    'stretched_curd',
    'processed'
);

CREATE TYPE protected_designation AS ENUM ('aop', 'aoc', 'igp', 'stg');

CREATE TYPE shop_kind AS ENUM ('cheesemonger', 'market', 'supermarket', 'farm', 'other');

CREATE TYPE osm_element AS ENUM ('node', 'way', 'relation');

CREATE TYPE rating_level AS ENUM ('inedible', 'poor', 'meh', 'good', 'delicious');

-- Ordinal projection of the rating scale, so aggregates (AVG over a cheese, over
-- a shop) stay in SQL. Kept in the database rather than in Rust because the
-- ordering is what the enum means, not a presentation choice.
CREATE FUNCTION rating_score(level rating_level) RETURNS smallint
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
AS $$
SELECT CASE level
    WHEN 'inedible' THEN 1
    WHEN 'poor' THEN 2
    WHEN 'meh' THEN 3
    WHEN 'good' THEN 4
    WHEN 'delicious' THEN 5
END;
$$;

-- Canonical form of a milk set, used by the cheese identity index: without it
-- {cow,goat} and {goat,cow} are two different array values and the unique index
-- lets the same cheese in twice.
CREATE FUNCTION sorted_milk_types(milks milk_type []) RETURNS milk_type []
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
AS $$
SELECT array_agg(DISTINCT milk ORDER BY milk) FROM unnest(milks) AS milk;
$$;

CREATE TABLE users (
    id uuid PRIMARY KEY,
    email text NOT NULL,
    display_name text NOT NULL,
    password_hash text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX users_email_key ON users (lower(email));

CREATE TABLE cheeses (
    id uuid PRIMARY KEY,
    name text NOT NULL,
    normalized_name text NOT NULL,
    milk_types milk_type [] NOT NULL,
    paste_type paste_type NOT NULL,
    designation protected_designation,
    aging_months integer,
    photo_key text,
    created_by uuid NOT NULL REFERENCES users (id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT cheeses_milk_types_not_empty CHECK (cardinality(milk_types) > 0),
    CONSTRAINT cheeses_aging_months_range CHECK (aging_months BETWEEN 0 AND 600)
);

-- Aging is part of the identity: a 18-month Comte and a 36-month Comte are not
-- the same cheese. NULLS NOT DISTINCT is what stops two rows whose only
-- difference is an unspecified aging.
CREATE UNIQUE INDEX cheeses_identity_key ON cheeses (
    normalized_name, sorted_milk_types(milk_types), paste_type, aging_months
) NULLS NOT DISTINCT;

CREATE TABLE shops (
    id uuid PRIMARY KEY,
    name text NOT NULL,
    kind shop_kind NOT NULL,
    osm_element osm_element NOT NULL,
    osm_id bigint NOT NULL,
    street text,
    postal_code text,
    city text NOT NULL,
    country_code char(2) NOT NULL,
    latitude double precision NOT NULL,
    longitude double precision NOT NULL,
    created_by uuid NOT NULL REFERENCES users (id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT shops_osm_ref_key UNIQUE (osm_element, osm_id),
    CONSTRAINT shops_latitude_range CHECK (latitude BETWEEN -90 AND 90),
    CONSTRAINT shops_longitude_range CHECK (longitude BETWEEN -180 AND 180)
);

CREATE TABLE tastings (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    cheese_id uuid NOT NULL REFERENCES cheeses (id) ON DELETE CASCADE,
    shop_id uuid NOT NULL REFERENCES shops (id) ON DELETE CASCADE,
    rating rating_level NOT NULL,
    price_per_kg_cents bigint,
    currency char(3),
    comment text,
    tasted_on date NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT tastings_price_positive CHECK (price_per_kg_cents > 0),
    CONSTRAINT tastings_price_needs_currency CHECK (
        (price_per_kg_cents IS NULL) = (currency IS NULL)
    )
);

CREATE INDEX tastings_cheese_id_idx ON tastings (cheese_id);
CREATE INDEX tastings_shop_id_idx ON tastings (shop_id);
CREATE INDEX tastings_user_id_idx ON tastings (user_id);

CREATE TABLE shop_reviews (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    shop_id uuid NOT NULL REFERENCES shops (id) ON DELETE CASCADE,
    score smallint NOT NULL,
    comment text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT shop_reviews_author_key UNIQUE (user_id, shop_id),
    CONSTRAINT shop_reviews_score_range CHECK (score BETWEEN 1 AND 5)
);

CREATE INDEX shop_reviews_shop_id_idx ON shop_reviews (shop_id);
