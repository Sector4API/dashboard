'use client';

import { useMemo } from 'react';
import { VChart } from '@visactor/react-vchart';
import type { IPieChartSpec } from '@visactor/react-vchart';
import { addThousandsSeparator } from '@/lib/utils';
import type { ChartProps } from './types';

function SubscriptionChart({ data }: ChartProps) {
  const chartData = useMemo(() => [
    { type: 'Premium', value: data.premium },
    { type: 'Preview', value: data.preview }
  ], [data.premium, data.preview]);

  const spec: IPieChartSpec = useMemo(() => ({
    type: 'pie',
    data: [
      {
        id: 'subscriptionData',
        values: chartData
      }
    ],
    valueField: 'value',
    categoryField: 'type',
    outerRadius: 0.8,
    innerRadius: 0.6,
    padAngle: 0.6,
    legends: [
      {
        visible: true,
        orient: 'bottom',
        type: 'discrete'
      }
    ],
    title: {
      visible: true,
      text: addThousandsSeparator(data.total),
      subtext: 'Total Users'
    },
    pie: {
      style: {
        cornerRadius: 6
      }
    },
    color: ['#3161F8', '#60C2FB']
  }), [chartData, data.total]);

  return (
    <div className="w-full h-full min-h-[300px]">
      <VChart spec={spec} />
    </div>
  );
}

SubscriptionChart.displayName = 'SubscriptionChart';

export { SubscriptionChart };
export default SubscriptionChart; 