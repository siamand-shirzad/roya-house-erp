import type { ReactNode } from "react";
import { useMatch, useParams } from "react-router-dom";
import { AppShell } from "@/components/app-shell";
import { SLUG_TO_TYPE } from "@/lib/documentTypeSlug";
import { DOCUMENT_TYPE_LABELS } from "@/types";

export function DocumentsLayout({ children }: { children: ReactNode }) {
  const { typeSlug } = useParams<{ typeSlug: string }>();
  const type = SLUG_TO_TYPE[typeSlug ?? ""];
  // The list is one "اسناد" section with a tab per type; a single document keeps its type's title.
  const onList = useMatch("/documents/:typeSlug") !== null;

  const title = onList || !type ? "اسناد" : DOCUMENT_TYPE_LABELS[type].title;
  return <AppShell title={title}>{children}</AppShell>;
}
