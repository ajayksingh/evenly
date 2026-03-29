# Evenly Auto-Optimization Goals

## Performance Targets
- Initial web load: < 3 seconds on 3G (Lighthouse simulated)
- Lighthouse Performance score: > 60
- Lighthouse Accessibility score: > 80
- Web bundle size (main chunk): < 3 MB
- API calls per login: <= 6 (1 getGroups + 5 parallel)
- Time to interactive: < 4 seconds

## Quality Rules (NEVER regress these)
- Zero horizontal overflow at 320px, 375px, 430px viewports
- Zero blank screens after any navigation action
- All Maestro core flows pass (02, 03, 18, 19)
- Settlement algorithm correctness: 100% on test scenarios
- Settlement transaction count: <= optimal for all test cases

## Optimization Priorities (in order)
1. Reduce initial bundle size (code splitting, tree shaking, lazy imports)
2. Reduce API calls (caching, deduplication, batch queries)
3. Reduce re-renders (memoization, stable references)
4. Reduce time to interactive (defer non-critical work)
5. Improve Lighthouse scores (accessibility, best practices)

## Constraints
- No new npm dependencies without explicit approval
- No changes to database schema
- No changes to Supabase RPC functions
- All changes must work on: web (iOS Safari, Android Chrome), Android native
- Preserve all existing functionality — performance-only changes
