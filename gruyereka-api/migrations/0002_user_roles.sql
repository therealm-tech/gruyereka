CREATE TYPE user_role AS ENUM ('user', 'moderator', 'admin');

-- Existing accounts predate roles and get the least privileged one. The default
-- is what keeps registration unable to grant anything: the insert never names
-- the column.
ALTER TABLE users ADD COLUMN role user_role NOT NULL DEFAULT 'user';

CREATE INDEX users_role_idx ON users (role);
