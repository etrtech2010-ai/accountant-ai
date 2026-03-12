import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

export interface DocumentProcessedEmailProps {
  firmName: string;
  fileName: string;
  itemCount: number;
  uploadedAt: string;
  reviewUrl: string;
}

export function DocumentProcessedEmail({
  firmName,
  fileName,
  itemCount,
  uploadedAt,
  reviewUrl,
}: DocumentProcessedEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{`✅ ${fileName} is ready for review — ${itemCount} item${itemCount !== 1 ? "s" : ""} extracted`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Text style={logo}>📊 Emplero</Text>
          </Section>

          <Section style={content}>
            <Heading style={h1}>Document ready for review</Heading>

            <Text style={text}>
              Hi {firmName} team,
            </Text>

            <Text style={text}>
              Your document has been processed successfully and is waiting for
              your review.
            </Text>

            <Section style={infoBox}>
              <Text style={infoLabel}>Document</Text>
              <Text style={infoValue}>{fileName}</Text>

              <Text style={infoLabel}>Items extracted</Text>
              <Text style={infoValue}>
                {itemCount} line item{itemCount !== 1 ? "s" : ""}
              </Text>

              <Text style={infoLabel}>Uploaded</Text>
              <Text style={infoValue}>{uploadedAt}</Text>
            </Section>

            <Section style={buttonContainer}>
              <Button style={button} href={reviewUrl}>
                Review Now →
              </Button>
            </Section>

            <Text style={footer}>
              Items have been automatically categorised by AI. Please review
              each item and approve, edit, or reject as needed.
            </Text>
          </Section>

          <Hr style={hr} />
          <Text style={footerText}>
            Emplero · You are receiving this because you uploaded a
            document to your firm workspace.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export function documentProcessedSubject(fileName: string, itemCount: number) {
  return `✅ ${fileName} is ready for review — ${itemCount} item${itemCount !== 1 ? "s" : ""} extracted`;
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
  padding: "24px 32px",
};

const logo = {
  color: "#ffffff",
  fontSize: "20px",
  fontWeight: "700",
  margin: "0",
};

const content = { padding: "32px" };

const h1 = {
  color: "#0f172a",
  fontSize: "22px",
  fontWeight: "700",
  margin: "0 0 16px",
};

const text = {
  color: "#374151",
  fontSize: "15px",
  lineHeight: "24px",
  margin: "0 0 12px",
};

const infoBox = {
  backgroundColor: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: "8px",
  padding: "16px 20px",
  margin: "20px 0",
};

const infoLabel = {
  color: "#6b7280",
  fontSize: "11px",
  fontWeight: "600",
  letterSpacing: "0.05em",
  textTransform: "uppercase" as const,
  margin: "8px 0 2px",
};

const infoValue = {
  color: "#0f172a",
  fontSize: "15px",
  fontWeight: "600",
  margin: "0 0 4px",
};

const buttonContainer = { textAlign: "center" as const, margin: "28px 0" };

const button = {
  backgroundColor: "#16a34a",
  borderRadius: "8px",
  color: "#ffffff",
  display: "inline-block",
  fontSize: "15px",
  fontWeight: "600",
  padding: "12px 28px",
  textDecoration: "none",
};

const footer = {
  color: "#6b7280",
  fontSize: "13px",
  lineHeight: "20px",
  margin: "0",
};

const hr = { borderColor: "#e2e8f0", margin: "0" };

const footerText = {
  color: "#9ca3af",
  fontSize: "12px",
  lineHeight: "18px",
  padding: "16px 32px",
  margin: "0",
};
