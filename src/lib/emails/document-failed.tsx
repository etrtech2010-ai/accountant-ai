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

export interface DocumentFailedEmailProps {
  firmName: string;
  fileName: string;
  uploadedAt: string;
  documentsUrl: string;
}

export function DocumentFailedEmail({
  firmName,
  fileName,
  uploadedAt,
  documentsUrl,
}: DocumentFailedEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>❌ Could not process {fileName} — upload a clearer image</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Text style={logo}>📊 Accountant AI</Text>
          </Section>

          <Section style={content}>
            <Section style={errorBadge}>
              <Text style={errorIcon}>❌</Text>
            </Section>

            <Heading style={h1}>Could not process document</Heading>

            <Text style={text}>Hi {firmName} team,</Text>

            <Text style={text}>
              We were unable to extract any items from the following document.
              This usually happens when the image is blurry, too dark, or the
              receipt text is not clearly visible.
            </Text>

            <Section style={infoBox}>
              <Text style={infoLabel}>Document</Text>
              <Text style={infoValue}>{fileName}</Text>

              <Text style={infoLabel}>Uploaded</Text>
              <Text style={infoValue}>{uploadedAt}</Text>
            </Section>

            <Heading style={h2}>What to do next</Heading>
            <Text style={text}>
              • Take a new photo in good lighting, keeping the receipt flat
              <br />
              • Make sure all text is in focus and clearly readable
              <br />
              • Avoid shadows or glare on the receipt
              <br />• Upload the improved image to try again
            </Text>

            <Section style={buttonContainer}>
              <Button style={button} href={documentsUrl}>
                Re-upload Document →
              </Button>
            </Section>
          </Section>

          <Hr style={hr} />
          <Text style={footerText}>
            Accountant AI · You are receiving this because a document upload
            failed in your firm workspace.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export function documentFailedSubject(fileName: string) {
  return `❌ Could not process ${fileName} — upload a clearer image`;
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

const errorBadge = {
  textAlign: "center" as const,
  padding: "24px 0 8px",
};

const errorIcon = {
  fontSize: "40px",
  margin: "0",
  lineHeight: "1",
};

const content = { padding: "0 32px 32px" };

const h1 = {
  color: "#0f172a",
  fontSize: "22px",
  fontWeight: "700",
  margin: "0 0 16px",
  textAlign: "center" as const,
};

const h2 = {
  color: "#0f172a",
  fontSize: "16px",
  fontWeight: "700",
  margin: "20px 0 8px",
};

const text = {
  color: "#374151",
  fontSize: "15px",
  lineHeight: "24px",
  margin: "0 0 12px",
};

const infoBox = {
  backgroundColor: "#fef2f2",
  border: "1px solid #fecaca",
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

const buttonContainer = { textAlign: "center" as const, margin: "28px 0 0" };

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
