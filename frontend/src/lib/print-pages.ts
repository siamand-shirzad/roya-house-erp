const A4_HEIGHT = 1122;

/** Build full-width pages using actual row heights, with room for final totals/signatures.
 * Caller owns the returned host and must remove it in finally, including capture failures.
 */
export function createPrintPages(node: HTMLElement) {
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText = "position:fixed;left:0;top:0;width:794px;z-index:-100;pointer-events:none;";
  host.inert = true;
  document.body.append(host);
  const sourceRows = [...node.querySelectorAll("tbody > tr")];
  const pages: HTMLElement[] = [];
  let index = 0;
  try {
    do {
      const page = node.cloneNode(true) as HTMLElement;
      page.removeAttribute("id");
      page.querySelectorAll("[id]").forEach((el) => el.removeAttribute("id"));
      page.style.zoom = "1";
      page.style.width = "794px";
      page.style.maxWidth = "none";
      page.style.position = "relative";
      page.style.paddingBottom = "48px";
      const tbody = page.querySelector("tbody");
      tbody?.replaceChildren();
      host.append(page);
      let count = 0;
      while (index < sourceRows.length && tbody) {
        const row = sourceRows[index].cloneNode(true);
        tbody.append(row);
        if (page.getBoundingClientRect().height > A4_HEIGHT) {
          row.parentNode?.removeChild(row);
          if (!count) throw new Error("یک ردیف یا توضیحات سند از یک صفحه بزرگ‌تر است. متن را کوتاه‌تر کنید.");
          break;
        }
        count++;
        index++;
      }
      if (!tbody && sourceRows.length) throw new Error("جدول سند قابل چاپ نیست.");
      if (page.getBoundingClientRect().height > A4_HEIGHT) throw new Error("توضیحات سند در یک صفحه جا نمی‌گیرد. متن را کوتاه‌تر کنید.");
      pages.push(page);
    } while (index < sourceRows.length);
    pages.forEach((page, i) => {
      if (i < pages.length - 1) page.querySelectorAll("tfoot, [data-print-ending]").forEach((el) => el.remove());
      page.style.minHeight = `${A4_HEIGHT}px`;
      const number = document.createElement("div");
      number.textContent = `${i + 1} / ${pages.length}`;
      number.style.cssText = "position:absolute;bottom:12px;left:32px;right:32px;text-align:center;font-size:10px;color:#555";
      page.append(number);
    });
    return { host, pages };
  } catch (err) {
    host.remove();
    throw err;
  }
}
