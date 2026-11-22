// Read-only invoice rendering. No storage, remote assets, scripts, or payment mutations.
export const escapeHTML = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const amount = (v) =>
  typeof v === "number" &&
  Number.isFinite(v) &&
  v >= 0 &&
  v <= Number.MAX_SAFE_INTEGER / 100
    ? v
    : null;
const round = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
export function invoiceModel(order, id) {
  if (!order || typeof order !== "object" || Array.isArray(order))
    throw Error("بيانات الطلب غير متاحة.");
  const items = (Array.isArray(order.items) ? order.items : []).map((i) => {
    i = i && typeof i === "object" ? i : {};
    const qty = amount(i.qty),
      price = amount(i.price);
    return {
      name: i.name ?? "",
      color: i.color ?? "",
      size: i.size ?? "",
      qty,
      price,
      total:
        qty !== null && price !== null && Number.isSafeInteger(qty) && qty > 0
          ? amount(round(qty * price))
          : null,
    };
  });
  const totals = Object.fromEntries(
    ["subtotal", "discount", "shipping", "total"].map((k) => [
      k,
      amount(order[k]),
    ]),
  );
  const warnings = [];
  if (!items.length) warnings.push("لا توجد أصناف مسجلة لهذا الطلب.");
  if (
    items.some((i) => i.total === null) ||
    Object.values(totals).some((v) => v === null)
  )
    warnings.push("بعض القيم غير مسجلة أو غير صالحة. لم نضع أصفارًا بديلة.");
  if (
    items.length &&
    items.every((i) => i.total !== null) &&
    totals.subtotal !== null &&
    Math.abs(round(items.reduce((s, i) => s + i.total, 0)) - totals.subtotal) >
      0.011
  )
    warnings.push("مجموع الأصناف يختلف عن المجموع الفرعي المسجل.");
  if (
    Object.values(totals).every((v) => v !== null) &&
    Math.abs(
      round(totals.subtotal - totals.discount + totals.shipping) - totals.total,
    ) > 0.011
  )
    warnings.push("تفاصيل المبالغ لا تطابق الإجمالي المسجل. راجع المتجر.");
  let date = null;
  try {
    const v = order.createdAt;
    const d = v?.toDate
      ? v.toDate()
      : v?.seconds != null
        ? new Date(v.seconds * 1000)
        : typeof v === "number"
          ? new Date(v)
          : null;
    if (d && Number.isFinite(d.getTime())) date = d;
  } catch {}
  const statuses = {
    pending: "قيد الانتظار",
    processing: "قيد التجهيز",
    shipped: "تم الشحن",
    completed: "تم التسليم",
    cancelled: "ملغي",
    refunded: "مرتجع",
  };
  return {
    number: order.orderNumber || id,
    customer: order.customerName ?? "",
    phone: order.phone ?? "",
    city: order.city ?? "",
    address: order.address ?? "",
    payment:
      order.paymentMethod === "cod"
        ? "الدفع عند الاستلام"
        : order.paymentMethod || "غير مسجلة",
    status: statuses[order.status] || "غير مسجلة",
    date,
    items,
    totals,
    warnings,
  };
}
export function renderInvoice(
  order,
  { id = "", name = "WESHAH", currency = "ج.م" } = {},
) {
  const m = invoiceModel(order, id),
    e = escapeHTML;
  const money = (v) =>
    v === null
      ? "غير مسجل"
      : `${new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 2 }).format(v)} ${e(currency)}`;
  const cells = m.items
    .map(
      (i, k) =>
        `<tr><td>${k + 1}</td><td><strong>${e(i.name)}</strong><small>${e([i.color, i.size].filter(Boolean).join(" · "))}</small></td><td>${i.qty === null ? "غير مسجلة" : e(i.qty)}</td><td>${money(i.price)}</td><td>${money(i.total)}</td></tr>`,
    )
    .join("");
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>فاتورة الطلب ${e(m.number)}</title><style>
*{box-sizing:border-box}body{margin:0;background:#f4f1e8;color:#18362a;font:14px/1.8 Tahoma,Arial,sans-serif;overflow-wrap:anywhere}.sheet{max-width:850px;background:white;margin:20px auto;padding:32px}header{border-bottom:3px solid #bb974e;display:flex;justify-content:space-between;gap:20px;padding-bottom:18px}h1{font-size:24px;margin:0}h2{font-size:17px;margin:0}.sub,small{display:block;color:#667269;font-size:12px}.meta,.address{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:20px 0}.box{border:1px solid #dedbcf;border-radius:10px;padding:12px}.box b{display:block;font-size:12px;color:#69786c}table{width:100%;border-collapse:collapse;margin:20px 0;font-size:13px}th{background:#0b4a33;color:white;text-align:right}td,th{padding:10px 7px;border-bottom:1px solid #ddd;vertical-align:top}td:nth-child(n+3){white-space:nowrap}.totals{max-width:350px;margin-right:auto}.line{display:flex;justify-content:space-between;gap:14px;padding:8px}.grand{background:#0b4a33;color:white;border-radius:8px;font-weight:bold}.note{margin-top:24px;padding-top:15px;border-top:1px solid #ddd;font-size:12px;color:#657069}.warning{background:#fff3d7;border:1px solid #c8a249;border-radius:8px;padding:12px;color:#654c1e}.status{font-size:13px;color:#536758}@media(max-width:560px){.sheet{margin:0;padding:18px 12px}.meta,.address{gap:8px}header{gap:8px}h1{font-size:19px}td,th{padding:8px 3px;font-size:11px}td:nth-child(n+3){white-space:normal;overflow-wrap:anywhere}.totals{max-width:none}}@page{size:A4;margin:12mm}@media print{body{background:white}.sheet{max-width:none;margin:0;padding:0}thead{display:table-header-group}tr,.box,.totals{break-inside:avoid}header{break-after:avoid}}
</style></head><body><main class="sheet"><header><div><h1>${e(name)}</h1><span class="sub">بيان طلب / فاتورة العميل</span></div><div><h2><bdi>${e(m.number)}</bdi></h2><span class="status">${e(m.status)}</span></div></header><section class="meta"><div class="box"><b>تاريخ الطلب</b>${m.date ? e(new Intl.DateTimeFormat("ar-EG", { dateStyle: "long", timeZone: "Africa/Cairo" }).format(m.date)) : "غير مسجل"}</div><div class="box"><b>طريقة الدفع المسجلة</b>${e(m.payment)}</div></section><section class="address"><div class="box"><b>العميل</b>${e(m.customer) || "غير مسجل"}<div dir="ltr">${e(m.phone)}</div></div><div class="box"><b>عنوان التسليم المسجل بالطلب</b>${e([m.city, m.address].filter(Boolean).join("، ")) || "غير مسجل"}</div></section><table><thead><tr><th>#</th><th>الصنف</th><th>الكمية</th><th>السعر</th><th>القيمة</th></tr></thead><tbody>${cells || '<tr><td colspan="5">لا توجد أصناف مسجلة</td></tr>'}</tbody></table><section class="totals">${[
    ["المجموع الفرعي", "subtotal"],
    ["الخصم", "discount"],
    ["الشحن", "shipping"],
    ["الإجمالي المسجل", "total"],
  ]
    .map(
      ([label, k]) =>
        `<div class="line ${k === "total" ? "grand" : ""}"><span>${label}</span><span>${money(m.totals[k])}</span></div>`,
    )
    .join(
      "",
    )}</section>${m.warnings.length ? `<aside class="warning">${m.warnings.map(e).join("<br>")}</aside>` : ""}<footer class="note">هذه نسخة من بيانات الطلب المسجلة، وليست إثبات سداد أو فاتورة ضريبية. حالة التسليم لا تثبت تحصيل المبلغ. لا تتضمن هذه النسخة حساب ضريبة غير مسجلة. رمز العملة حسب إعدادات المتجر الحالية، دون تحويل عملة.</footer></main></body></html>`;
}
// Reads only by document ID selected from the current account's authorized list.
// The server rules remain the authorization boundary; UID and epoch checks also stop stale UI.
export function createOwnInvoiceLoader({
  getIdentity,
  readOrder,
  show,
  clear,
  onError,
}) {
  let request = 0;
  const same = (a, b) =>
    !!a && !!b && a.uid === b.uid && a.generation === b.generation;
  return {
    clear() {
      request++;
      clear();
    },
    async open(id, knownIds) {
      const ticket = ++request,
        identity = getIdentity();
      clear();
      if (
        !identity ||
        typeof id !== "string" ||
        !/^[A-Za-z0-9_-]{1,128}$/.test(id) ||
        !knownIds.includes(id)
      ) {
        onError("تعذّر فتح فاتورة هذا الطلب.");
        return false;
      }
      try {
        const order = await readOrder(id);
        if (ticket !== request || !same(identity, getIdentity())) return false;
        if (!order || order.uid !== identity.uid)
          throw Error("تعذّر التحقق من ملكية الطلب.");
        show(order, id);
        return true;
      } catch (error) {
        if (ticket === request && same(identity, getIdentity()))
          onError("تعذّر قراءة الفاتورة الآن. أعد المحاولة من طلباتك.");
        return false;
      }
    },
  };
}
