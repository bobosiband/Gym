/**
 * Fallback screen for unrecognised paths. The router hits this when
 * the browser URL does not match any registered route.
 */
export function NotFoundScreen(): JSX.Element {
  return (
    <section aria-labelledby="not-found-title">
      <h1 id="not-found-title">Page not found</h1>
      <p>
        That URL does not match anything in the app. <a href="/">Go home</a>.
      </p>
    </section>
  );
}
