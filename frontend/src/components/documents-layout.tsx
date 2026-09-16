import type { ReactNode } from "react";
import { useMatch, useParams } from "react-router-dom";
import { AppShell } from "@/components/app-shell";
import { SLUG_TO_TYPE } from "@/lib/documentTypeSlug";
import { DOCUMENT_TYPE_LABELS } from "@/types";

export function DocumentsLayout({ children }: { children: ReactNode }) {
  const { typeSlug } = useParams<{ typeSlug: string }>();
  const type = SLUG_TO_TYPE[typeSlug ?? ""];
  // The list shows its section name (from lib/navigation.ts via the
  // breadcrumb); the form replaces this with the document's number.
  const onNew = useMatch("/documents/:typeSlug/new") !== null;
  const title = !type ? "اسناد" : onNew ? `${DOCUMENT_TYPE_LABELS[type].name} جدید` : DOCUMENT_TYPE_LABELS[type].name;
  return <AppShell title={title}>{children}</AppShell>;
}
