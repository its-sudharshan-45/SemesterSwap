import React from 'react';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'circular' | 'rectangular';
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  variant = 'rectangular',
  ...props
}) => {
  const shapes = {
    text: 'h-4 w-full rounded-md',
    circular: 'h-12 w-12 rounded-full',
    rectangular: 'h-32 w-full rounded-2xl',
  };

  return (
    <div
      className={`animate-pulse bg-slate-200 dark:bg-darkbg-border ${shapes[variant]} ${className}`}
      {...props}
    />
  );
};
export default Skeleton;
