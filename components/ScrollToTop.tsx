import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Ensures every navigation (including clicks from the footer, which sits at
 * the bottom of the page) scrolls the viewport back to the top. Without this,
 * React Router preserves scroll position across route changes, which makes
 * it look like nothing happened when navigating from a link near the bottom
 * of a long page.
 */
export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
