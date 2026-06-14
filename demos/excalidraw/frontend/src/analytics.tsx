import { useEffect } from 'react';
import ReactGA from 'react-ga4';

const GA_MEASUREMENT_ID = 'G-B4W8XZX31B';

let isAnalyticsInitialized = false;

function initializeAnalytics() {
  if (isAnalyticsInitialized || typeof window === 'undefined') {
    return;
  }

  ReactGA.initialize(GA_MEASUREMENT_ID);
  isAnalyticsInitialized = true;
}

function trackPageView() {
  ReactGA.send({
    hitType: 'pageview',
    page: `${window.location.pathname}${window.location.search}${window.location.hash}`,
  });
}

export function AnalyticsTracker() {
  useEffect(() => {
    initializeAnalytics();

    const handleLocationChange = () => {
      trackPageView();
    };

    const originalPushState = window.history.pushState.bind(window.history);
    const originalReplaceState = window.history.replaceState.bind(window.history);

    window.history.pushState = function pushState(...args) {
      const result = originalPushState(...args);
      window.dispatchEvent(new Event('locationchange'));
      return result;
    };

    window.history.replaceState = function replaceState(...args) {
      const result = originalReplaceState(...args);
      window.dispatchEvent(new Event('locationchange'));
      return result;
    };

    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);
    window.addEventListener('locationchange', handleLocationChange);

    handleLocationChange();

    return () => {
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
      window.removeEventListener('locationchange', handleLocationChange);
    };
  }, []);

  return null;
}
