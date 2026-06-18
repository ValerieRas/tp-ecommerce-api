import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-session";

export async function GET() {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const orders = await prisma.order.findMany({
    where: { userId: session.user.id },
    include: {
      items: { include: { product: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(orders);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const body = await req.json();
  const { items } = body as {
    items: { productId: string; quantity: number }[];
  };

  if (!items || items.length === 0) {
    return NextResponse.json(
      { error: "La commande doit contenir au moins un article" },
      { status: 400 }
    );
  }

  const products = await prisma.product.findMany({
    where: { id: { in: items.map((i) => i.productId) } },
  });

  for (const item of items) {
    const product = products.find((p) => p.id === item.productId);
    if (!product)
      return NextResponse.json(
        { error: `Produit ${item.productId} introuvable` },
        { status: 404 }
      );
    if (product.stock < item.quantity) {
      return NextResponse.json(
        { error: `Stock insuffisant pour ${product.name}` },
        { status: 409 }
      );
    }
  }

  const order = await prisma.$transaction(async (tx) => {
    const newOrder = await tx.order.create({
      data: {
        userId: session.user.id,
        items: {
          create: items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: products.find((p) => p.id === item.productId)!.price,
          })),
        },
      },
      include: { items: { include: { product: true } } },
    });

    for (const item of items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { decrement: item.quantity } },
      });
    }

    return newOrder;
  });

  return NextResponse.json(order, { status: 201 });
}