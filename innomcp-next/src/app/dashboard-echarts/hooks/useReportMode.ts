import { useEffect, useState, RefObject } from "react";

/**
 * Custom hook to detect if the component is being rendered in report/preview mode
 * @param chartRef - Optional reference to the chart container
 * @returns boolean indicating if in report mode
 */
export function useReportMode(chartRef?: RefObject<HTMLElement | null>): boolean {
  const [isInReportMode, setIsInReportMode] = useState(false);

  useEffect(() => {
    const checkReportMode = () => {
      // Check if chartRef is provided and has the data-for-report attribute
      if (chartRef?.current) {
        let element = chartRef.current as HTMLElement;
        while (element) {
          if (element.getAttribute && element.getAttribute('data-for-report') === 'true') {
            setIsInReportMode(true);
            return;
          }
          element = element.parentElement as HTMLElement;
        }
      }

      // Fallback: check from document body for any data-for-report attribute
      const reportElements = document.querySelectorAll('[data-for-report="true"]');
      if (reportElements.length > 0) {
        setIsInReportMode(true);
        return;
      }

      setIsInReportMode(false);
    };

    // Check immediately
    checkReportMode();

    // Set up mutation observer and polling for reliability
    const observer = new MutationObserver(checkReportMode);
    const interval = setInterval(checkReportMode, 50); // Check every 50ms for faster detection
    
    // Observe the entire document body for data-for-report attribute changes
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['data-for-report'],
      subtree: true
    });

    return () => {
      observer.disconnect();
      clearInterval(interval);
    };
  }, [chartRef]);

  return isInReportMode;
}
