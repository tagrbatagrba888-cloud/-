import { DATASET, validateDataset, validateAddress, registrationFields } from './egypt-address-model.mjs';
const DATA_URL = new URL('./egypt-addresses/egypt-addresses-capmas-2023.json', import.meta.url);
let cached;
export async function loadAddresses(fetcher = fetch) {
  if (!cached) cached = fetcher(DATA_URL, { credentials: 'same-origin', cache: 'no-cache' })
    .then(response => { if (!response.ok) throw new Error('تعذّر تحميل دليل المناطق'); return response.json(); })
    .then(validateDataset).catch(error => { cached = undefined; throw error; });
  return cached;
}
const el = (tag, text, attrs = {}) => {
  const node = document.createElement(tag); if (text) node.textContent = text;
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  return node;
};
function field(parent, label, tag, attrs) {
  const box = el('div', '', { class: 'eg-field' }), node = el(tag, '', attrs);
  const caption = el('label', label); caption.append(node); box.append(caption); parent.append(box); return node;
}
function options(select, rows, placeholder) {
  select.replaceChildren(el('option', placeholder, { value: '' }), ...rows.map(row => el('option', row.display_name_ar || row.name_ar, { value: row.code })));
}
export function mountAddress(host, { load = loadAddresses } = {}) {
  host.classList.add('eg-address'); host.dir = 'rtl';
  const legend = el('h3', 'عنوان مصر');
  const notice = el('p', 'دليل يناير ٢٠٢٣، بقرارات حتى ٣١ ديسمبر ٢٠٢٢. قد لا يشمل منطقتك الحالية. يمكنك إدخال منطقة غير مدرجة.', { class: 'eg-note' });
  const status = el('p', 'جارٍ تحميل المناطق…', { role: 'status', 'aria-live': 'polite', class: 'eg-status' });
  const grid = el('div', '', { class: 'eg-grid' }); host.append(legend, notice, grid);
  const governorate = field(grid, 'المحافظة *', 'select', { 'data-eg': 'governorate', autocomplete: 'address-level1', disabled: '' });
  const center = field(grid, 'المركز / القسم / المدينة *', 'select', { 'data-eg': 'center', disabled: '' });
  const locality = field(grid, 'القرية / الحي / المنطقة *', 'select', { 'data-eg': 'locality', disabled: '' });
  const customLabel = el('label', '', { class: 'eg-custom-check' }), custom = el('input', '', { type: 'checkbox', 'data-eg': 'custom' });
  customLabel.append(custom, document.createTextNode(' منطقتي غير موجودة في القائمة')); host.append(customLabel);
  const customBox = el('div', '', { class: 'eg-grid', hidden: '' });
  const customCenter = field(customBox, 'اسم المركز / القسم / المدينة *', 'input', { maxlength: '100', 'data-eg': 'custom-center' });
  const customLocality = field(customBox, 'اسم القرية / الحي / المنطقة *', 'input', { maxlength: '100', 'data-eg': 'custom-locality' });
  host.append(customBox);
  const details = field(host, 'العنوان التفصيلي: الشارع، المبنى، الدور / الشقة، علامة مميزة *', 'textarea', { rows: '3', maxlength: '1800', autocomplete: 'street-address', 'data-eg': 'details' });
  const source = el('small', 'المصدر: الجهاز المركزي للتعبئة العامة والإحصاء، دليل الوحدات الإدارية، يناير ٢٠٢٣. أعيد تنسيق البيانات واختصار بعض الأوصاف.', { class: 'eg-source' });
  const sourceLink = el('a', 'المصدر الأصلي', { href: 'https://www.capmas.gov.eg:8080/Publication/Pdf/f6952a1c-fcb5-41a9-8246-07bf860d9fd5.pdf', target: '_blank', rel: 'noopener noreferrer' }); source.append(' ', sourceLink);
  const retry = el('button', 'إعادة تحميل المناطق', { type: 'button', class: 'eg-retry', hidden: '' });
  host.append(source, status, retry);
  let data, touched = false, alive = true, epoch = 0;
  options(governorate, [], 'اختر المحافظة'); options(center, [], 'اختر المحافظة أولًا'); options(locality, [], 'اختر المركز أولًا');
  host.addEventListener('input', () => { touched = true; });
  function resetChildren() {
    options(center, [], 'اختر المركز / القسم'); options(locality, [], 'اختر المركز أولًا');
    center.disabled = !data || !governorate.value || custom.checked; locality.disabled = true;
    customCenter.value = ''; customLocality.value = '';
  }
  governorate.addEventListener('change', () => {
    touched = true; resetChildren();
    if (data) options(center, data.centers.filter(c => c.governorate_code === governorate.value), 'اختر المركز / القسم');
  });
  center.addEventListener('change', () => {
    touched = true;
    options(locality, data ? data.localities.filter(l => l.governorate_code === governorate.value && l.parent_code === center.value) : [], 'اختر القرية / الحي / المنطقة');
    locality.disabled = !center.value || custom.checked;
  });
  locality.addEventListener('change', () => { touched = true; });
  custom.addEventListener('change', () => {
    touched = true; customBox.hidden = !custom.checked; resetChildren();
    if (data) options(center, data.centers.filter(c => c.governorate_code === governorate.value), 'اختر المركز / القسم');
  });
  async function reload() {
    const ticket = ++epoch; data = undefined; governorate.disabled = true; resetChildren();
    status.textContent = 'جارٍ تحميل المناطق…'; retry.hidden = true;
    try {
      const next = await load();
      if (!alive || ticket !== epoch) return;
      data = next; options(governorate, data.governorates, 'اختر المحافظة'); governorate.disabled = false;
      status.textContent = 'اختر المحافظة ثم المركز ثم المنطقة، أو استخدم منطقة غير مدرجة.';
    } catch (_) {
      if (!alive || ticket !== epoch) return;
      status.textContent = 'تعذّر تحميل دليل المناطق. راجع الاتصال وأعد المحاولة.'; retry.hidden = false;
    }
  }
  retry.addEventListener('click', reload);
  const rawInput = () => ({ datasetVersion: DATASET, mode: custom.checked ? 'custom' : 'listed',
    governorateCode: governorate.value,
    ...(custom.checked ? { customCenter: customCenter.value, customLocality: customLocality.value } : { centerCode: center.value, localityCode: locality.value }),
    details: details.value });
  const ready = reload();
  return {
    ready, get dirty() { return touched; },
    collectInput() { if (!data) throw new Error('انتظر تحميل المناطق أو أعد المحاولة'); validateAddress(rawInput(), data); return rawInput(); },
    snapshot() { return rawInput(); },
    async setValue(value) {
      await ready; if (!alive || !data || !value || touched) return;
      // Restore incomplete same-account drafts without guessing missing codes.
      const normalized = { ...value };
      if (!data.governorates.some(g => g.code === normalized.governorateCode)) normalized.governorateCode = '';
      if (!data.centers.some(c => c.code === normalized.centerCode && c.governorate_code === normalized.governorateCode)) normalized.centerCode = '';
      if (!data.localities.some(l => l.code === normalized.localityCode && l.parent_code === normalized.centerCode && l.governorate_code === normalized.governorateCode)) normalized.localityCode = '';
      governorate.value = normalized.governorateCode; custom.checked = normalized.mode === 'custom'; customBox.hidden = !custom.checked;
      options(center, data.centers.filter(c => c.governorate_code === governorate.value), 'اختر المركز / القسم');
      center.value = normalized.centerCode || ''; center.disabled = custom.checked;
      options(locality, data.localities.filter(l => l.governorate_code === governorate.value && l.parent_code === center.value), 'اختر القرية / الحي / المنطقة');
      locality.value = normalized.localityCode || ''; locality.disabled = custom.checked || !center.value;
      customCenter.value = normalized.customCenter || ''; customLocality.value = normalized.customLocality || ''; details.value = normalized.details || ''; touched = false;
      status.textContent = 'راجع المحافظة والمركز والمنطقة والعنوان التفصيلي قبل الحفظ.';
    },
    collect() {
      if (!data) throw new Error('انتظر تحميل المناطق أو أعد المحاولة');
      return validateAddress(rawInput(), data);
    },
    message(message) { status.textContent = message; },
    destroy() { alive = false; epoch++; }
  };
}
