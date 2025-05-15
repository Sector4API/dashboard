import Container from "@/components/container";

export default function TicketLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Container>
      {children}
    </Container>
  );
}
