# Project rules
- Keep fetching on the existing Cloud cron and news tables; Firebase serves the frontend only, avoiding an unverified data migration.
- Share source URL normalization and enablement rules between ingestion and regression tests so admin changes reach the same fetch path.
- Keep official brand media in asset pointers and generate Hosting-local copies during deployment because Firebase does not serve Lovable's host-relative asset gateway.