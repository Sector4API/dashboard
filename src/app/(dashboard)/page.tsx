import {
  Metrics,
  SubscriptionStatus
} from "@/components/chart-blocks";
import TemplateTrends from "@/components/chart-blocks/charts/template-trends";
import TemplateLeaderboard from "@/components/chart-blocks/charts/template-leaderboard";
import Container from "@/components/container";

export default function Home() {
  return (
    <div>
      <Metrics />
      <div className="grid grid-cols-1 divide-y border-b border-border laptop:grid-cols-2 laptop:divide-x laptop:divide-y-0 laptop:divide-border">
        <Container className="py-4 laptop:col-span-1">
          <TemplateTrends />
        </Container>
        <Container className="py-4 laptop:col-span-1">
          <TemplateLeaderboard />
        </Container>
      </div>
      <div className="grid grid-cols-1 divide-y border-b border-border laptop:grid-cols-2 laptop:divide-x laptop:divide-y-0 laptop:divide-border">
        <Container className="py-4 laptop:col-span-1">
          <SubscriptionStatus />
        </Container>
      </div>
    </div>
  );
}
