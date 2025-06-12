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
      <div className="grid grid-cols-1 laptop:grid-cols-2">
        <div className="flex flex-col divide-y border-b border-border laptop:border-r">
          <Container className="py-4">
            <TemplateTrends />
          </Container>
          <Container className="py-4">
            <SubscriptionStatus />
          </Container>
        </div>
        <Container className="py-4 border-b border-border">
          <TemplateLeaderboard />
        </Container>
      </div>
    </div>
  );
}
