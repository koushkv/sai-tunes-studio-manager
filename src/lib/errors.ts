/**
 * Turns a Firestore/Firebase error into something a student can act on.
 *
 * Firestore surfaces failures as terse codes ("permission-denied"), which are
 * useless in the UI and — worse — indistinguishable from each other when they
 * all collapse into a generic "try again". Keeping them separate matters here:
 * a rules misconfiguration and a dropped connection need opposite responses.
 */
export function firestoreErrorMessage(err: unknown, fallback: string): string {
  const code = typeof err === 'object' && err !== null && 'code' in err
    ? String((err as { code: unknown }).code)
    : '';

  switch (code) {
    case 'permission-denied':
    case 'firestore/permission-denied':
      return 'You do not have permission for that. Your access level may have changed — sign out and back in, or ask an admin.';

    case 'unauthenticated':
    case 'firestore/unauthenticated':
      return 'Your session has expired. Please sign in again.';

    case 'unavailable':
    case 'firestore/unavailable':
      return 'Cannot reach the database. Check your internet connection and try again.';

    case 'resource-exhausted':
    case 'firestore/resource-exhausted':
      // Expected on the shared AI Studio quota this project runs under.
      return 'The database has hit its usage limit for now. Please try again in a few minutes.';

    case 'deadline-exceeded':
    case 'firestore/deadline-exceeded':
      return 'The database took too long to respond. Please try again.';

    case 'not-found':
    case 'firestore/not-found':
      return 'That record no longer exists — someone may have deleted it.';

    case 'already-exists':
    case 'firestore/already-exists':
      return 'That record already exists.';

    case 'failed-precondition':
    case 'firestore/failed-precondition':
      return 'The database rejected that request. It may need an index, or the record changed while you were editing.';

    case 'cancelled':
    case 'firestore/cancelled':
      return 'The request was cancelled. Please try again.';

    default:
      return fallback;
  }
}
