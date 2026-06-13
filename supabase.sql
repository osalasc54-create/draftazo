create table rooms (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  status text not null default 'lobby',
  mode integer not null,
  current_turn integer not null default 0,
  created_at timestamp default now()
);

create table room_players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade,
  name text not null,
  position integer not null,
  created_at timestamp default now()
);

create table draft_picks (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade,
  player_name text not null,
  friend_id text not null,
  created_at timestamp default now()
);

create table lineups (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade,
  player_name text not null,
  slot text not null,
  friend_id text not null,
  created_at timestamp default now()
);
