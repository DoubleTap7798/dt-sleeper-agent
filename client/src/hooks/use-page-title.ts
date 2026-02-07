import { useEffect } from "react";

const BASE_TITLE = "DT Sleeper Agent";

export function usePageTitle(pageTitle?: string) {
  useEffect(() => {
    if (pageTitle) {
      document.title = `${pageTitle} | ${BASE_TITLE}`;
    } else {
      document.title = `${BASE_TITLE} - Fantasy Football Companion for Sleeper Leagues`;
    }
    return () => {
      document.title = `${BASE_TITLE} - Fantasy Football Companion for Sleeper Leagues`;
    };
  }, [pageTitle]);
}
