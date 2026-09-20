import { type RefObject, useEffect, useState } from 'react';

type ScrollDirection = 'down' | 'up';

const useScrollDirection = (
  scrollRef: RefObject<HTMLElement | null>,
  scrollSensibility = 2,
): ScrollDirection | undefined => {
  const [scrollDirection, setScrollDirection] = useState<ScrollDirection>();

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) {
      return;
    }

    let previousY = element.scrollTop;
    const onScroll = () => {
      const y = element.scrollTop;
      const delta = y - previousY;
      previousY = y;
      // ignore jitter: only a move larger than the sensibility counts as a direction change
      if (delta > scrollSensibility) {
        setScrollDirection('down');
      } else if (delta < -scrollSensibility) {
        setScrollDirection('up');
      }
    };

    element.addEventListener('scroll', onScroll, { passive: true });
    return () => element.removeEventListener('scroll', onScroll);
  }, [scrollRef, scrollSensibility]);

  return scrollDirection;
};

export default useScrollDirection;
