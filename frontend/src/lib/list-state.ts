import { useSearchParams } from "react-router-dom";

/** URL-backed filters survive detail navigation, browser back, and shared links. */
export function useListState() {
  const [params, setParams] = useSearchParams();
  function update(patch: Record<string, string | null>, resetPage = true) {
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (resetPage) next.delete("page");
      for (const [key, value] of Object.entries(patch)) {
        if (!value) next.delete(key);
        else next.set(key, value);
      }
      return next;
    }, { replace: true });
  }
  return { params, update };
}

export function useUrlPagination<T>(rows: T[], pageSize = 10) {
  const { params, update } = useListState();
  const raw = Number(params.get("page") ?? 1);
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const page = Math.min(pageCount, Number.isSafeInteger(raw) && raw > 0 ? raw : 1);
  return {
    page, pageCount, pageSize, total: rows.length,
    pageRows: rows.slice((page - 1) * pageSize, page * pageSize),
    setPage: (value: number) => update({ page: String(Math.max(1, Math.min(value, pageCount))) }, false),
  };
}
