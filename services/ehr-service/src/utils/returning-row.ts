/**
 * TypeORM's raw DataSource/QueryRunner `.query()` returns rows directly for
 * SELECT and INSERT ... RETURNING, but returns a `[rows, affectedRowCount]`
 * tuple for UPDATE/DELETE ... RETURNING. Code that blindly does `rows[0]` on
 * the latter gets the wrapped one-element array back (e.g. `[theRealRow]`)
 * instead of the row itself, so every field read silently evaluates to
 * `undefined`. Use this helper on any UPDATE/DELETE ... RETURNING result to
 * get the actual first row regardless of which shape was returned.
 */
export function firstReturningRow<T = any>(queryResult: any): T | undefined {
  const rows = Array.isArray(queryResult?.[0]) ? queryResult[0] : queryResult;
  return rows?.[0];
}
