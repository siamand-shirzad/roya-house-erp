import type { ReactNode } from "react";
import { useParams } from "react-router-dom";
import { AppShell } from "@/components/app-shell";
import { SLUG_TO_TYPE } from "@/lib/documentTypeSlug";
import { DOCUMENT_TYPE_LABELS } from "@/types";

export function DocumentsLayout({ children }: { children: ReactNode }) {
  const { typeSlug } = useParams<{ typeSlug: string }>();
  const type = SLUG_TO_TYPE[typeSlug ?? ""];

  return <AppShell title={type ? DOCUMENT_TYPE_LABELS[type].title : "اسناد"}>{children}</AppShell>;
}
