import { useEffect, useMemo } from 'react';

import { graphviz, type GraphvizOptions } from 'd3-graphviz';

/**
 * d3-graphviz forwards `width`/`height` to the SVG attributes, so CSS lengths work even though
 * `@types/d3-graphviz` declares them as numbers.
 */
export type GraphvizSizedOptions = Omit<GraphvizOptions, 'width' | 'height'> & {
  width?: number | string;
  height?: number | string;
};

export interface IGraphvizProps {
  /**
   * A string containing a graph representation using the Graphviz DOT language.
   * @see https://graphviz.org/doc/info/lang.html
   */
  dot: string;

  /**
   * Options to pass to the Graphviz renderer.
   */
  options?: GraphvizSizedOptions;

  /**
   * The classname to attach to this component for styling purposes.
   */
  className?: string;
}

const defaultOptions: GraphvizSizedOptions = {
  fit: true,
  height: 500,
  width: 500,
  zoom: false,
};

let counter = 0;
const getId = () => `graphviz${counter++}`;

export const Graphviz = ({ dot, className, options = {} }: IGraphvizProps) => {
  const id = useMemo(() => getId(), []);

  useEffect(() => {
    graphviz(`#${id}`, {
      ...defaultOptions,
      ...options,
    } as GraphvizOptions).renderDot(dot);
  }, [id, dot, options]);

  return <div className={className} id={id} />;
};

export default Graphviz;
