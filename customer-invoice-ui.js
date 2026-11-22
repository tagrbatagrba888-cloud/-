import { createOwnInvoiceLoader, renderInvoice } from "./customer-invoice.js";
export function mountOwnInvoices({
  getIdentity,
  readOrder,
  getKnownIds,
  getBrand,
  onError,
}) {
  const overlay = document.createElement("div");
  overlay.className = "modal";
  overlay.id = "invoiceModal";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "فاتورة طلبي");
  overlay.innerHTML =
    '<div class="modalbox" style="max-width:940px;width:100%;padding:12px"><div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:12px"><h2 style="font-size:17px;margin:0;flex:1">فاتورة طلبي</h2><button type="button" class="btn btn-dark invoice-print">طباعة / حفظ PDF</button><button type="button" class="btn btn-outline invoice-close">إغلاق</button></div><iframe title="بيانات فاتورة الطلب" sandbox="allow-same-origin allow-modals" referrerpolicy="no-referrer" style="display:block;border:0;width:100%;height:65vh;background:white;border-radius:10px"></iframe></div>';
  document.body.append(overlay);
  const frame = overlay.querySelector("iframe");
  let shownIdentity = null,
    previousFocus = null,
    ready = false,
    renderToken = null;
  const frameMatches = () => {
    try { return !!renderToken && frame.contentDocument?.querySelector('meta[name="weshah-invoice-render"]')?.content === renderToken; }
    catch { return false; }
  };
  frame.style.visibility = "hidden";
  const same = () => {
    const current = getIdentity();
    return (
      shownIdentity &&
      current &&
      current.uid === shownIdentity.uid &&
      current.generation === shownIdentity.generation
    );
  };
  const clear = () => {
    ready = false;
    renderToken = null;
    frame.style.visibility = "hidden";
    shownIdentity = null;
    overlay.classList.remove("show");
    frame.srcdoc = "";
    if (!document.querySelector(".modal.show,.drawer.show"))
      document.body.classList.remove("lock");
    if (previousFocus?.isConnected) previousFocus.focus();
    previousFocus = null;
  };
  const loader = createOwnInvoiceLoader({
    getIdentity,
    readOrder,
    onError,
    clear,
    show(order, id) {
      shownIdentity = getIdentity();
      previousFocus = document.activeElement;
      ready = false;
      frame.style.visibility = "hidden";
      renderToken = crypto.randomUUID();
      frame.srcdoc = renderInvoice(order, { id, ...getBrand() }).replace("<head>", `<head><meta name="weshah-invoice-render" content="${renderToken}">`);
      overlay.classList.add("show");
      document.body.classList.add("lock");
      overlay.querySelector(".invoice-close").focus();
    },
  });
  frame.addEventListener("load", () => {
    ready = !!same() && frameMatches();
    frame.style.visibility = ready ? "visible" : "hidden";
  });
  overlay
    .querySelector(".invoice-close")
    .addEventListener("click", () => loader.clear());
  overlay.querySelector(".invoice-print").addEventListener("click", () => {
    if (!same()) {
      loader.clear();
      return;
    }
    if (!ready || !frameMatches()) {
      onError("انتظر تحميل الفاتورة ثم أعد الطباعة.");
      return;
    }
    try {
      frame.contentWindow.focus();
      frame.contentWindow.print();
    } catch {
      onError("تعذّرت الطباعة. أعد فتح الفاتورة وحاول مرة أخرى.");
    }
  });
  overlay.addEventListener("mousedown", (e) => {
    if (e.target === overlay) loader.clear();
  });
  overlay.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      loader.clear();
    }
    if (e.key === "Tab") {
      const a = overlay.querySelector(".invoice-print"),
        b = overlay.querySelector(".invoice-close");
      if (e.shiftKey && document.activeElement === a) {
        e.preventDefault();
        b.focus();
      } else if (!e.shiftKey && document.activeElement === b) {
        e.preventDefault();
        a.focus();
      }
    }
  });
  window.addEventListener("pagehide", () => loader.clear());
  return {
    open: (id) => loader.open(id, getKnownIds()),
    clear: () => loader.clear(),
  };
}
