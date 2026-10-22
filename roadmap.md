# Requested work
- [x] Reuters World absent from live records; removed hardcoded backup source path to prevent its return.
- [x] Fix and verify add/edit/enable/disable RSS sources and automatic import without changing schedule or deleting articles.
- [x] Apply uploaded official site image, favicon and search/image metadata; static metadata/image update released to Firebase.
- [x] Verify admin source flow and imported article on Firebase live site; 42 BBC test articles preserved and test source disabled afterwards.
- [ ] Deploy updated compiled frontend to Firebase: blocked by unavailable automatic build artifact; live compiled frontend preserved. Backend fixes already deployed.
- [ ] Confirm external GitHub sync/push: project Git sync status unavailable to agent; no manual git mutations permitted.- [ ] Tickers (live/markets/breaking) blank on RTL: fixed in code with shared Marquee (LTR-anchored track, measured speed); verify + publish once backend is back.
- [x] Free GitHub fetcher no longer needs the backend (backup source list + market prices), site/tickers read GitHub data.
- [ ] Point the site at the GitHub repo and publish: blocked on the repo name (owner/repo, must be public).
