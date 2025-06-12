export interface SubscriptionData {
  premium: number;
  preview: number;
  total: number;
}

export interface ChartProps {
  data: SubscriptionData;
} 