import React from "react";
import NewsDetailClient from "@/app/news/[id]/NewsDetailClient";

export default async function NewsDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  return <NewsDetailClient id={resolvedParams.id} />;
}
