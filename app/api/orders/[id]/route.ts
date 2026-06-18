import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-session";

const VALID_STATUSES = ["PENDING", "CONFIRMED", "SHIPPED", "CANCELLED"];

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id } = await params;
  const order = await prisma.order.findFirst({
    where: { id, userId: session.user.id },
    include: { items: { include: { product: true } } },
  });

  if (!order)
    return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  return NextResponse.json(order);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id } = await params;
  const { status } = await req.json();

  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Statut invalide" }, { status: 400 });
  }

  const order = await prisma.order.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!order)
    return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  const updated = await prisma.order.update({
    where: { id },
    data: { status },
  });
  return NextResponse.json(updated);
}