import { RefObject, useEffect, useState } from 'react';

import { usePrevious, useScroll } from 'react-use';

const useScrollDirection = (scrollRef: RefObject<HTMLElement>, scrollSensibility = 2) => {
  const [scrollDirection, setScrollDirection] = useState<'down' | 'up'>();
  const { y } = useScroll(scrollRef);
  const prevY = usePrevious<number>(y) ?? y;

  useEffect(() => {
    const direction = y > prevY ? 'down' : 'up';
    if (direction !== scrollDirection && (y - prevY > scrollSensibility || y - prevY < -scrollSensibility)) {
      setScrollDirection(direction);
    }
  }, [scrollSensibility, y, prevY, scrollDirection, setScrollDirection]);

  return scrollDirection;
};

export default useScrollDirection;
