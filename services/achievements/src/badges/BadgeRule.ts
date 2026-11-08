import type { UserSnapshot } from '../achievements/UserSnapshot.js';

/**
 * Metadata frozen on a badge at unlock time. Each rule carries its
 * own copy so a later rename of the rule class does not retroactively
 * rewrite a user's history.
 */
export interface BadgeMetadata {
  readonly badgeId: string;
  readonly name: string;
  readonly description: string;
}

/**
 * Pluggable strategy that decides, from the user's rolling snapshot,
 * whether the badge should unlock. Rules are pure functions: they
 * read the snapshot and never mutate state. The service orchestrates
 * persistence and emission.
 *
 * Adding a new badge is a new file in `src/badges/` plus a line in
 * `DefaultBadgeRegistryFactory`. Nothing in the service itself is
 * edited.
 */
export interface BadgeRule {
  readonly metadata: BadgeMetadata;
  shouldUnlock(snapshot: UserSnapshot): boolean;
}
