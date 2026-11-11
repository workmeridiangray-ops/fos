CREATE UNIQUE INDEX unique_pending_payout ON records(owner) WHERE kind='payout' AND json_extract(data,'$.status')='pending';
CREATE UNIQUE INDEX unique_provider_transfer ON records(json_extract(data,'$.providerId')) WHERE kind='payout' AND json_extract(data,'$.providerId') IS NOT NULL;
