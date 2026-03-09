import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ClientsClient } from "@/components/clients/clients-client";

export default async function ClientsPage() {
  const user = await getCurrentUser();
  const firmId = user.firmId;

  const clients = await prisma.client.findMany({
    where: { firmId },
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: { documents: true, items: true },
      },
    },
  });

  const serialized = clients.map((c) => ({
    ...c,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }));

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Clients</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your firm&apos;s clients. Assign documents and transactions to
          specific clients.
        </p>
      </div>

      <ClientsClient initialClients={serialized} />
    </div>
  );
}
