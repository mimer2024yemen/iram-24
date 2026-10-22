# Project rules
- News and market data have two paths: the Cloud cron/tables (admin, archive) and the free GitHub Action JSON in /data that the site reads directly; the GitHub path must never depend on Cloud being awake, because the free Cloud allowance can pause the backend.
- Share source URL normalization and enablement rules between ingestion and regression tests so admin changes reach the same fetch path.
- Keep official brand media in asset pointers and generate Hosting-local copies during deployment because Firebase does not serve Lovable's host-relative asset gateway.