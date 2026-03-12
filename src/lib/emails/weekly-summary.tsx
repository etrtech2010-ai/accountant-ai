import {
  Body,
  Button,
  Column,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

export interface WeeklySummaryEmailProps {
  firmName: string;
  weekStart: string;
  weekEnd: string;
  docsProcessed: number;
  itemsApproved: number;
  itemsPending: number;
  topCategory: string | null;
  totalSpend: number;
  currency: string;
  dashboardUrl: string;
}

export function WeeklySummaryEmail({
  firmName,
  weekStart,
  weekEnd,
  docsProcessed,
  itemsApproved,
  itemsPending,
  topCategory,
  totalSpend,
  currency,
  dashboardUrl,
}: WeeklySummaryEmailProps) {
  const formattedSpend = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    minimumFractionDigits: 2,
  }).format(totalSpend);

  return (
    <Html>
      <Head />
      <Preview>{`📊 Weekly summary — ${firmName}: ${docsProcessed} docs, ${itemsApproved} approved, ${formattedSpend} total`}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Text style={logo}>📊 Emplero</Text>
            <Text style={headerSub}>Weekly Summary</Text>
          </Section>

          <Section style={content}>
            <Heading style={h1}>Your week at a glance</Heading>
            <Text style={subtitle}>
              {firmName} · {weekStart} – {weekEnd}
            </Text>

            {/* Stats Grid */}
            <Section style={statsGrid}>
              <Row>
                <Column style={statCell}>
                  <Text style={statNumber}>{docsProcessed}</Text>
                  <Text style={statLabel}>Docs Processed</Text>
                </Column>
                <Column style={statCell}>
                  <Text style={statNumber}>{itemsApproved}</Text>
                  <Text style={statLabel}>Items Approved</Text>
                </Column>
                <Column style={statCell}>
                  <Text style={{ ...statNumber, color: itemsPending > 0 ? "#d97706" : "#16a34a" }}>
                    {itemsPending}
                  </Text>
                  <Text style={statLabel}>Pending Review</Text>
                </Column>
              </Row>
            </Section>

            {/* Spend Summary */}
            <Section style={spendBox}>
              <Row>
                <Column>
                  <Text style={spendLabel}>Total Approved Spend</Text>
                  <Text style={spendAmount}>{formattedSpend}</Text>
                </Column>
                {topCategory && (
                  <Column style={{ textAlign: "right" as const }}>
                    <Text style={spendLabel}>Top Category</Text>
                    <Text style={topCategoryText}>{topCategory}</Text>
                  </Column>
                )}
              </Row>
            </Section>

            {/* Pending callout */}
            {itemsPending > 0 && (
              <Section style={pendingBox}>
                <Text style={pendingText}>
                  ⚠️ You have <strong>{itemsPending}</strong> item
                  {itemsPending !== 1 ? "s" : ""} waiting for review. Approve
                  them to keep your books up to date.
                </Text>
              </Section>
            )}

            <Section style={buttonContainer}>
              <Button style={button} href={dashboardUrl}>
                View Dashboard →
              </Button>
            </Section>
          </Section>

          <Hr style={hr} />
          <Text style={footerText}>
            Emplero · Weekly summary for {firmName}. You receive this
            every week.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export function weeklySummarySubject(firmName: string) {
  return `📊 Weekly summary — ${firmName}`;
}

// Styles
const main = { backgroundColor: "#f6f9fc", fontFamily: "Arial, sans-serif" };

const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "0",
  maxWidth: "580px",
  borderRadius: "8px",
  overflow: "hidden",
  boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
};

const header = {
  backgroundColor: "#0f172a",
  padding: "24px 32px 20px",
};

const logo = {
  color: "#ffffff",
  fontSize: "20px",
  fontWeight: "700",
  margin: "0 0 4px",
};

const headerSub = {
  color: "#94a3b8",
  fontSize: "13px",
  margin: "0",
};

const content = { padding: "32px" };

const h1 = {
  color: "#0f172a",
  fontSize: "22px",
  fontWeight: "700",
  margin: "0 0 4px",
};

const subtitle = {
  color: "#6b7280",
  fontSize: "14px",
  margin: "0 0 24px",
};

const statsGrid = {
  backgroundColor: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: "8px",
  padding: "20px",
  margin: "0 0 16px",
};

const statCell = {
  textAlign: "center" as const,
  padding: "0 8px",
};

const statNumber = {
  color: "#0f172a",
  fontSize: "32px",
  fontWeight: "700",
  margin: "0 0 4px",
  lineHeight: "1",
};

const statLabel = {
  color: "#6b7280",
  fontSize: "12px",
  fontWeight: "600",
  textTransform: "uppercase" as const,
  letterSpacing: "0.05em",
  margin: "0",
};

const spendBox = {
  backgroundColor: "#0f172a",
  borderRadius: "8px",
  padding: "20px 24px",
  margin: "0 0 16px",
};

const spendLabel = {
  color: "#94a3b8",
  fontSize: "11px",
  fontWeight: "600",
  textTransform: "uppercase" as const,
  letterSpacing: "0.05em",
  margin: "0 0 4px",
};

const spendAmount = {
  color: "#ffffff",
  fontSize: "28px",
  fontWeight: "700",
  margin: "0",
  lineHeight: "1",
};

const topCategoryText = {
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: "600",
  margin: "0",
};

const pendingBox = {
  backgroundColor: "#fffbeb",
  border: "1px solid #fde68a",
  borderRadius: "8px",
  padding: "14px 18px",
  margin: "0 0 16px",
};

const pendingText = {
  color: "#92400e",
  fontSize: "14px",
  lineHeight: "20px",
  margin: "0",
};

const buttonContainer = { textAlign: "center" as const, margin: "24px 0 0" };

const button = {
  backgroundColor: "#2563eb",
  borderRadius: "8px",
  color: "#ffffff",
  display: "inline-block",
  fontSize: "15px",
  fontWeight: "600",
  padding: "12px 28px",
  textDecoration: "none",
};

const hr = { borderColor: "#e2e8f0", margin: "0" };

const footerText = {
  color: "#9ca3af",
  fontSize: "12px",
  lineHeight: "18px",
  padding: "16px 32px",
  margin: "0",
};
