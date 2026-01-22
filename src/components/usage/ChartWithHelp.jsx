import React from 'react';
import { VizHelp } from '../ui';

const baseClass = 'chart-with-help';

function ChartWithHelp({ children, text, className }) {
  const classes = className ? `${baseClass} ${className}` : baseClass;
  return (
    <div className={classes}>
      {children}
      <VizHelp text={text} />
    </div>
  );
}

export default ChartWithHelp;
