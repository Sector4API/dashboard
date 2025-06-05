'use client';

import dynamic from 'next/dynamic';

const StagewiseToolbarWrapper = dynamic(
  () => import('./StagewiseToolbarWrapper'),
  { ssr: false }
);

export default function StageWiseLoader() {
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }
  
  return <StagewiseToolbarWrapper />;
} 