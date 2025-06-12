'use client';

import Container from "@/components/container";
import MetricCard from "./components/metric-card";
import { useTemplateMetrics } from "@/hooks/useTemplateMetrics";
import { Spinner } from "@/components/ui/spinner";

export default function Metrics() {
  const { metrics, loading, error } = useTemplateMetrics();

  if (loading) {
    return (
      <Container className="flex justify-center items-center py-8">
        <Spinner className="w-8 h-8" />
      </Container>
    );
  }

  if (error) {
    return (
      <Container className="py-4 text-center text-red-500">
        Failed to load metrics
      </Container>
    );
  }

  const metricsData = [
    {
      title: "Total Templates",
      value: metrics.totalTemplates.toString(),
      change: metrics.totalChange,
    },
    {
      title: "Published Templates",
      value: metrics.publishedTemplates.toString(),
      change: metrics.publishedChange,
    },
    {
      title: "Unpublished Templates",
      value: metrics.unpublishedTemplates.toString(),
      change: metrics.unpublishedChange,
    },
    {
      title: "Flyers Exported",
      value: metrics.flyersExported.toString(),
      change: metrics.exportChange,
    },
  ];

  return (
    <Container className="grid grid-cols-1 gap-y-6 border-b border-border py-4 phone:grid-cols-2 laptop:grid-cols-4">
      {metricsData.map((metric) => (
        <MetricCard key={metric.title} {...metric} />
      ))}
    </Container>
  );
}
