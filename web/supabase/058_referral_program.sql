-- Referral Program: Track referrals and reward tokens

-- Referrals table: tracks who referred who
create table if not exists referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_user_id uuid not null references auth.users(id) on delete cascade,
  referred_user_id uuid not null references auth.users(id) on delete cascade,
  referral_code text not null,
  status text not null default 'pending',
  plan_purchased text,
  referred_at timestamptz not null default now(),
  converted_at timestamptz,
  created_at timestamptz not null default now(),
  unique(referrer_user_id, referred_user_id)
);

-- Referral rewards: tracks token awards
create table if not exists referral_rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  referral_id uuid not null references referrals(id) on delete cascade,
  reward_type text not null,
  tokens integer not null,
  awarded_at timestamptz not null default now()
);

create index if not exists referrals_referrer_idx on referrals(referrer_user_id);
create index if not exists referrals_referred_idx on referrals(referred_user_id);
create index if not exists referrals_code_idx on referrals(referral_code);
create index if not exists referral_rewards_user_idx on referral_rewards(user_id);
