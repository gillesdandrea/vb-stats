import { PropsWithChildren, RefObject } from 'react';

import cx from 'classnames';

import useScrollDirection from './useScrollDirection';

import './Headroom.scss';

// @see https://www.codemzy.com/blog/react-sticky-header-disappear-scroll

export interface Props {
  scrollRef: RefObject<HTMLElement>;
  className?: string;
}

const Headroom = ({ scrollRef, className, children }: PropsWithChildren<Props>) => {
  const scrollDirection = useScrollDirection(scrollRef);
  return <div className={cx('headroom', { down: scrollDirection === 'down' }, className)}>{children}</div>;
};

export default Headroom;
