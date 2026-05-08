import { firebaseConfig } from "./firebase-config.js";
import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Firebase init
let db = null;
try {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
} catch (e) {
  console.warn("Firebase init error", e);
}

// Тарифы
const RATES = {
  standard: 1.2,
  deep: 1.8,
  office: 1.5,
};

const MIN_PRICE = {
  standard: 40,
  deep: 70,
  office: 60,
};

function calcPrice(type, area) {
  const rate = RATES[type] ?? RATES.standard;
  const min = MIN_PRICE[type] ?? 0;
  const raw = rate * area;
  return Math.max(raw, min);
}

function formatPrice(value) {
  if (!Number.isFinite(value)) return "—";
  return value.toFixed(0);
}

function updateQuickPrice() {
  const type = document.getElementById("quickType").value;
  const area = Number(document.getElementById("quickArea").value || 0);
  const price = calcPrice(type, area);
  document.getElementById("quickPrice").textContent = formatPrice(price);
}

function updateOrderPrice() {
  const type = document.getElementById("type").value;
  const area = Number(document.getElementById("areaSize").value || 0);
  const price = calcPrice(type, area);
  document.getElementById("orderPrice").textContent = formatPrice(price);
}

function generateOrderId() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.floor(Math.random() * 999)
    .toString()
    .padStart(3, "0");
  return `ST-${ts}-${rand}`;
}

// Modal
function openModal() {
  const modal = document.getElementById("orderModal");
  if (!modal) return;
  modal.classList.add("modal--open");
  modal.setAttribute("aria-hidden", "false");
}

function closeModal() {
  const modal = document.getElementById("orderModal");
  if (!modal) return;
  modal.classList.remove("modal--open");
  modal.setAttribute("aria-hidden", "true");
}

function initModal() {
  const modal = document.getElementById("orderModal");
  if (!modal) return;
  modal.addEventListener("click", (e) => {
    if (e.target.matches("[data-modal-close]")) {
      closeModal();
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });
}

// Навигация
function initNav() {
  const menuBtn = document.getElementById("menuToggle");
  const nav = document.querySelector(".nav");
  if (menuBtn && nav) {
    menuBtn.addEventListener("click", () => {
      nav.classList.toggle("nav--open");
    });

    nav.addEventListener("click", (e) => {
      if (e.target.matches(".nav__link")) {
        nav.classList.remove("nav--open");
      }
    });
  }

  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", (e) => {
      const href = link.getAttribute("href");
      if (!href || href === "#") return;
      const target = document.querySelector(href);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

// Быстрый расчёт
function initQuickForm() {
  const form = document.getElementById("quickQuoteForm");
  if (!form) return;

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const type = document.getElementById("quickType").value;
    const area = document.getElementById("quickArea").value;
    const orderType = document.getElementById("type");
    const orderArea = document.getElementById("areaSize");

    if (orderType) orderType.value = type;
    if (orderArea) orderArea.value = area;

    updateOrderPrice();

    const orderSection = document.getElementById("order");
    if (orderSection) {
      orderSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });

  document.getElementById("quickType").addEventListener("change", updateQuickPrice);
  document.getElementById("quickArea").addEventListener("input", updateQuickPrice);

  updateQuickPrice();
}

// Форма заказа
async function saveOrderToFirebase(data) {
  if (!db) {
    console.warn("Firestore not initialized, order not saved");
    return;
  }
  await addDoc(collection(db, "orders"), {
    ...data,
    createdAt: serverTimestamp(),
  });
}

function initOrderForm() {
  const form = document.getElementById("orderForm");
  if (!form) return;

  ["type", "areaSize"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    const eventName = id === "areaSize" ? "input" : "change";
    el.addEventListener(eventName, updateOrderPrice);
  });

  updateOrderPrice();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!form.reportValidity()) return;

    const data = {
      id: generateOrderId(),
      name: form.name.value.trim(),
      phone: form.phone.value.trim(),
      area: form.area.value.trim(),
      type: form.type.value,
      areaSize: Number(form.areaSize.value || 0),
      date: form.date.value,
      time: form.time.value,
      comment: form.comment.value.trim(),
      price: calcPrice(form.type.value, Number(form.areaSize.value || 0)),
      createdAtLocal: new Date().toISOString(),
      status: "pending",
    };

    try {
      await saveOrderToFirebase(data);
    } catch (err) {
      console.warn("Не удалось сохранить заказ в Firebase", err);
    }

    const orderIdEl = document.getElementById("orderId");
    if (orderIdEl) orderIdEl.textContent = data.id;

    openModal();
    form.reset();
    updateOrderPrice();
  });
}

// Год
function initYear() {
  const yearEl = document.getElementById("year");
  if (!yearEl) return;
  yearEl.textContent = new Date().getFullYear();
}

// WhatsApp
function initWhatsApp() {
  const link = document.getElementById("whatsappLink");
  if (!link) return;

  const phone = "+905555555555"; // подставь реальный номер
  const text = encodeURIComponent(
    "Здравствуйте! Хочу заказать уборку на Северном Кипре через сайт SupTemiz."
  );
  link.href = `https://wa.me/${phone.replace(/[^0-9]/g, "")}?text=${text}`;
}

// PWA install
let deferredPrompt = null;

function initPWAInstall() {
  const installBtn = document.getElementById("installBtn");
  if (!installBtn) return;

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installBtn.hidden = false;
  });

  installBtn.addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      installBtn.hidden = true;
    }
    deferredPrompt = null;
  });
}

// Service worker
function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw.js")
      .catch((err) => console.warn("SW registration failed", err));
  });
}

// i18n
const translations = {
  ru: {
    "nav.services": "Услуги",
    "nav.pricing": "Цены",
    "nav.how": "Как это работает",
    "nav.reviews": "Отзывы",
    "nav.order": "Заказать уборку",

    "hero.title": "Чистота без хлопот на Северном Кипре с <span>SupTemiz</span>",
    "hero.subtitle":
      "Профессиональная уборка квартир, вилл и офисов на Северном Кипре. Приезжаем вовремя, работаем аккуратно, оставляем только свежесть и порядок.",
    "hero.ctaPrimary": "Заказать уборку",
    "hero.ctaSecondary": "Посмотреть цены",
    "hero.badge1": "✔ Северный Кипр: Фамагуста, Искеле, Кирения",
    "hero.badge2": "✔ Проверенный персонал",
    "hero.badge3": "✔ Поддержка на русском, турецком и английском",
    "hero.calcTitle": "Быстрый расчёт",
    "hero.calcButton": "Оформить заказ",

    "services.title": "Наши услуги",
    "services.subtitle": "Подберём формат уборки под вашу задачу на Северном Кипре.",
    "services.standard.title": "Стандартная уборка",
    "services.standard.text": "Поддерживающая уборка для тех, кто ценит порядок каждый день.",
    "services.standard.item1": "Протирка поверхностей",
    "services.standard.item2": "Пылесос и влажная уборка пола",
    "services.standard.item3": "Уборка кухни и санузла",
    "services.deep.title": "Генеральная уборка",
    "services.deep.text": "Глубокая уборка после ремонта, переезда или просто «с нуля».",
    "services.deep.item1": "Мытьё труднодоступных мест",
    "services.deep.item2": "Чистка плитки, сантехники",
    "services.deep.item3": "Обработка кухонных поверхностей",
    "services.office.title": "Офисы и коммерция",
    "services.office.text": "Регулярная уборка офисов, салонов и коммерческих помещений.",
    "services.office.item1": "Гибкий график",
    "services.office.item2": "Фиксированная стоимость",
    "services.office.item3": "Работа до/после рабочего дня",

    "pricing.title": "Прозрачные цены",
    "pricing.subtitle": "Без скрытых доплат — всё видно заранее.",
    "pricing.standardPrice": "от 1.2 €/м²",
    "pricing.standardText": "Идеально для регулярной уборки квартиры или небольшой виллы.",
    "pricing.standardMin": "Минимальный заказ — 40 €",
    "pricing.standardTime": "Среднее время — 2–3 часа",
    "pricing.deepPrice": "от 1.8 €/м²",
    "pricing.deepText": "Глубокая уборка с максимальным вниманием к деталям.",
    "pricing.deepMin": "Минимальный заказ — 70 €",
    "pricing.deepTime": "Среднее время — 4–6 часов",
    "pricing.officePrice": "от 1.5 €/м²",
    "pricing.officeText": "Регулярная уборка офисов и коммерческих помещений.",
    "pricing.officeMin": "Минимальный заказ — 60 €",
    "pricing.officeTime": "Индивидуальный график",

    "how.title": "Как это работает",
    "how.step1.title": "Оставляете заявку",
    "how.step1.text": "Заполняете форму на сайте или пишете нам в WhatsApp.",
    "how.step2.title": "Уточняем детали",
    "how.step2.text": "Перезваниваем, подтверждаем время, стоимость и адрес.",
    "how.step3.title": "Приезжаем и убираем",
    "how.step3.text": "Вы отдыхаете, мы приводим помещение в идеальный порядок.",

    "reviews.title": "Отзывы клиентов",
    "reviews.r1.text":
      "«Заказали генеральную уборку виллы в Искеле. Приехали вовремя, всё сделали за один день. Очень довольны!»",
    "reviews.r1.author": "— Анна",
    "reviews.r2.text":
      "«Пользуемся регулярной уборкой офиса в Фамагусте. Всегда чисто, аккуратно, без напоминаний.»",
    "reviews.r2.author": "— Сергей",
    "reviews.r3.text":
      "«Удобно, что можно быстро посчитать стоимость и оставить заявку прямо на сайте.»",
    "reviews.r3.author": "— Мария",

    "order.title": "Оформить заказ",
    "order.subtitle":
      "Заполните форму — мы свяжемся с вами, уточним детали и подтвердим время.",
    "order.info1":
      "Работаем на Северном Кипре: Фамагуста, Искеле, Кирения и окрестности",
    "order.info2": "График: каждый день с 9:00 до 21:00",
    "order.info3": "Можно обсудить детали в WhatsApp",
    "order.whatsapp": "Написать в WhatsApp",
    "order.submit": "Отправить заявку",

    "form.name": "Имя",
    "form.phone": "Телефон (WhatsApp)",
    "form.region": "Район / город",
    "form.type": "Тип уборки",
    "form.area": "Площадь, м²",
    "form.date": "Дата",
    "form.time": "Время",
    "form.comment": "Комментарий",
    "form.commentPlaceholder": "Код от домофона, особенности, пожелания",
    "form.estimateLabel": "Ориентировочная стоимость:",
    "form.estimateNote": "Точная цена будет подтверждена оператором.",
    "form.privacy":
      "Нажимая кнопку, вы соглашаетесь с обработкой персональных данных.",

    "types.standard": "Стандартная",
    "types.deep": "Генеральная",
    "types.office": "Офис",

    "footer.about":
      "Профессиональная уборка квартир, вилл и офисов на Северном Кипре.",
    "footer.contactsTitle": "Контакты",
    "footer.phoneLabel": "Телефон / WhatsApp:",
    "footer.navTitle": "Навигация",
    "footer.admin": "Админка заказов",
    "footer.tagline": "Сделано для Северного Кипра",

    "modal.title": "Заявка отправлена",
    "modal.text":
      "Спасибо! Мы получили вашу заявку и свяжемся с вами в ближайшее время для подтверждения.",
    "modal.orderId": "Номер заявки:",
    "modal.ok": "Понятно",

    "pwa.install": "Установить"
  },
  tr: {
    "nav.services": "Hizmetler",
    "nav.pricing": "Fiyatlar",
    "nav.how": "Nasıl çalışır",
    "nav.reviews": "Yorumlar",
    "nav.order": "Temizlik siparişi",

    "hero.title": "Kuzey Kıbrıs'ta zahmetsiz temizlik — <span>SupTemiz</span>",
    "hero.subtitle":
      "Kuzey Kıbrıs'ta daire, villa ve ofisler için profesyonel temizlik. Zamanında gelir, özenle çalışırız.",
    "hero.ctaPrimary": "Temizlik siparişi ver",
    "hero.ctaSecondary": "Fiyatları gör",
    "hero.badge1": "✔ Kuzey Kıbrıs: Gazimağusa, İskele, Girne",
    "hero.badge2": "✔ Güvenilir personel",
    "hero.badge3": "✔ Rusça, Türkçe ve İngilizce destek",
    "hero.calcTitle": "Hızlı hesaplama",
    "hero.calcButton": "Siparişe geç",

    "services.title": "Hizmetlerimiz",
    "services.subtitle":
      "Kuzey Kıbrıs'taki ihtiyacınıza göre temizlik seçin.",
    "services.standard.title": "Standart temizlik",
    "services.standard.text":
      "Düzen sevenler için düzenli bakım temizliği.",
    "services.standard.item1": "Yüzeylerin silinmesi",
    "services.standard.item2": "Süpürme ve ıslak zemin temizliği",
    "services.standard.item3": "Mutfak ve banyo temizliği",
    "services.deep.title": "Detaylı temizlik",
    "services.deep.text":
      "Tadilat sonrası, taşınma veya derin temizlik için.",
    "services.deep.item1": "Zor alanların temizliği",
    "services.deep.item2": "Fayans ve armatür temizliği",
    "services.deep.item3": "Mutfak yüzeylerinin temizliği",
    "services.office.title": "Ofis ve ticari alanlar",
    "services.office.text":
      "Ofisler ve küçük ticari alanlar için düzenli temizlik.",
    "services.office.item1": "Esnek çalışma saatleri",
    "services.office.item2": "Sabit fiyat",
    "services.office.item3": "Mesai öncesi/sonrası çalışma",

    "pricing.title": "Şeffaf fiyatlar",
    "pricing.subtitle": "Gizli ücret yok — her şey önceden belli.",
    "pricing.standardPrice": "1.2 €/m²'den",
    "pricing.standardText":
      "Daire veya küçük villa için ideal düzenli temizlik.",
    "pricing.standardMin": "Minimum sipariş — 40 €",
    "pricing.standardTime": "Ortalama süre — 2–3 saat",
    "pricing.deepPrice": "1.8 €/m²'den",
    "pricing.deepText": "Maksimum detayla derin temizlik.",
    "pricing.deepMin": "Minimum sipariş — 70 €",
    "pricing.deepTime": "Ortalama süre — 4–6 saat",
    "pricing.officePrice": "1.5 €/m²'den",
    "pricing.officeText": "Ofis ve ticari alanlar için düzenli temizlik.",
    "pricing.officeMin": "Minimum sipariş — 60 €",
    "pricing.officeTime": "Bireysel program",

    "how.title": "Nasıl çalışıyoruz",
    "how.step1.title": "Talep bırakın",
    "how.step1.text":
      "Sitedeki formu doldurun veya WhatsApp'tan yazın.",
    "how.step2.title": "Detayları netleştiriyoruz",
    "how.step2.text":
      "Arayıp saat, fiyat ve adresi onaylıyoruz.",
    "how.step3.title": "Gelip temizliyoruz",
    "how.step3.text":
      "Siz dinlenin, biz evi/iş yerini tertemiz yapalım.",

    "reviews.title": "Müşteri yorumları",
    "reviews.r1.text":
      "“İskele'deki villada detaylı temizlik yaptırdık. Zamanında geldiler, bir günde bitirdiler.”",
    "reviews.r1.author": "— Anna",
    "reviews.r2.text":
      "“Gazimağusa'daki ofisimiz için düzenli temizlik alıyoruz. Her zaman temiz ve düzenli.”",
    "reviews.r2.author": "— Sergey",
    "reviews.r3.text":
      "“Fiyatı hızlıca hesaplayıp siteden talep bırakmak çok pratik.”",
    "reviews.r3.author": "— Maria",

    "order.title": "Sipariş formu",
    "order.subtitle":
      "Formu doldurun — sizi arayıp detayları netleştireceğiz.",
    "order.info1":
      "Kuzey Kıbrıs'ta çalışıyoruz: Gazimağusa, İskele, Girne ve çevresi",
    "order.info2": "Çalışma saatleri: her gün 9:00–21:00",
    "order.info3": "Detayları WhatsApp üzerinden konuşabiliriz",
    "order.whatsapp": "WhatsApp'tan yaz",
    "order.submit": "Talep gönder",

    "form.name": "İsim",
    "form.phone": "Telefon (WhatsApp)",
    "form.region": "Bölge / şehir",
    "form.type": "Temizlik türü",
    "form.area": "Metrekare",
    "form.date": "Tarih",
    "form.time": "Saat",
    "form.comment": "Not",
    "form.commentPlaceholder": "Site, kapı kodu, özel istekler",
    "form.estimateLabel": "Tahmini fiyat:",
    "form.estimateNote": "Kesin fiyat operatör tarafından onaylanacaktır.",
    "form.privacy":
      "Butona basarak kişisel verilerinizin işlenmesini kabul ediyorsunuz.",

    "types.standard": "Standart",
    "types.deep": "Detaylı",
    "types.office": "Ofis",

    "footer.about":
      "Kuzey Kıbrıs'ta daire, villa ve ofisler için profesyonel temizlik.",
    "footer.contactsTitle": "İletişim",
    "footer.phoneLabel": "Telefon / WhatsApp:",
    "footer.navTitle": "Menü",
    "footer.admin": "Yönetim paneli",
    "footer.tagline": "Kuzey Kıbrıs için hazırlandı",

    "modal.title": "Talep gönderildi",
    "modal.text":
      "Teşekkürler! Talebinizi aldık, en kısa sürede sizi arayacağız.",
    "modal.orderId": "Talep numarası:",
    "modal.ok": "Tamam",

    "pwa.install": "Uygulama olarak yükle"
  },
  en: {
    "nav.services": "Services",
    "nav.pricing": "Pricing",
    "nav.how": "How it works",
    "nav.reviews": "Reviews",
    "nav.order": "Book cleaning",

    "hero.title": "Effortless cleaning in North Cyprus with <span>SupTemiz</span>",
    "hero.subtitle":
      "Professional cleaning for apartments, villas and offices in North Cyprus. On time, careful, reliable.",
    "hero.ctaPrimary": "Book cleaning",
    "hero.ctaSecondary": "View prices",
    "hero.badge1": "✔ North Cyprus: Famagusta, Iskele, Kyrenia",
    "hero.badge2": "✔ Trusted staff",
    "hero.badge3": "✔ Support in Russian, Turkish and English",
    "hero.calcTitle": "Quick estimate",
    "hero.calcButton": "Go to order",

    "services.title": "Our services",
    "services.subtitle":
      "Choose the cleaning format that fits your needs in North Cyprus.",
    "services.standard.title": "Standard cleaning",
    "services.standard.text":
      "Regular maintenance cleaning for everyday comfort.",
    "services.standard.item1": "Surface wiping",
    "services.standard.item2": "Vacuuming and mopping floors",
    "services.standard.item3": "Kitchen and bathroom cleaning",
    "services.deep.title": "Deep cleaning",
    "services.deep.text":
      "Perfect after renovation, moving or for a full reset.",
    "services.deep.item1": "Hard-to-reach areas",
    "services.deep.item2": "Tile and sanitary cleaning",
    "services.deep.item3": "Kitchen surfaces treatment",
    "services.office.title": "Offices and commercial",
    "services.office.text":
      "Regular cleaning for offices and small commercial spaces.",
    "services.office.item1": "Flexible schedule",
    "services.office.item2": "Fixed pricing",
    "services.office.item3": "Before/after working hours",

    "pricing.title": "Transparent pricing",
    "pricing.subtitle": "No hidden fees — everything is clear upfront.",
    "pricing.standardPrice": "from 1.2 €/m²",
    "pricing.standardText":
      "Ideal for regular cleaning of an apartment or small villa.",
    "pricing.standardMin": "Minimum order — 40 €",
    "pricing.standardTime": "Average time — 2–3 hours",
    "pricing.deepPrice": "from 1.8 €/m²",
    "pricing.deepText": "Deep cleaning with maximum attention to detail.",
    "pricing.deepMin": "Minimum order — 70 €",
    "pricing.deepTime": "Average time — 4–6 hours",
    "pricing.officePrice": "from 1.5 €/m²",
    "pricing.officeText":
      "Regular cleaning for offices and commercial spaces.",
    "pricing.officeMin": "Minimum order — 60 €",
    "pricing.officeTime": "Custom schedule",

    "how.title": "How it works",
    "how.step1.title": "You submit a request",
    "how.step1.text":
      "Fill out the form on the website or message us on WhatsApp.",
    "how.step2.title": "We confirm details",
    "how.step2.text":
      "We call you back to confirm time, price and address.",
    "how.step3.title": "We arrive and clean",
    "how.step3.text":
      "You relax while we bring your place to perfect order.",

    "reviews.title": "Client reviews",
    "reviews.r1.text":
      "“Ordered deep cleaning of a villa in Iskele. They arrived on time and finished in one day.”",
    "reviews.r1.author": "— Anna",
    "reviews.r2.text":
      "“We use regular office cleaning in Famagusta. Always tidy, no reminders needed.”",
    "reviews.r2.author": "— Sergey",
    "reviews.r3.text":
      "“Love that I can quickly estimate the price and send a request right on the site.”",
    "reviews.r3.author": "— Maria",

    "order.title": "Place an order",
    "order.subtitle":
      "Fill in the form — we will contact you to confirm details and time.",
    "order.info1":
      "We work in North Cyprus: Famagusta, Iskele, Kyrenia and nearby areas",
    "order.info2": "Schedule: every day from 9:00 to 21:00",
    "order.info3": "You can discuss details via WhatsApp",
    "order.whatsapp": "Message on WhatsApp",
    "order.submit": "Send request",

    "form.name": "Name",
    "form.phone": "Phone (WhatsApp)",
    "form.region": "Area / city",
    "form.type": "Cleaning type",
    "form.area": "Area, m²",
    "form.date": "Date",
    "form.time": "Time",
    "form.comment": "Comment",
    "form.commentPlaceholder": "Gate code, specifics, wishes",
    "form.estimateLabel": "Estimated price:",
    "form.estimateNote": "Final price will be confirmed by the operator.",
    "form.privacy":
      "By clicking the button you agree to the processing of personal data.",

    "types.standard": "Standard",
    "types.deep": "Deep",
    "types.office": "Office",

    "footer.about":
      "Professional cleaning of apartments, villas and offices in North Cyprus.",
    "footer.contactsTitle": "Contacts",
    "footer.phoneLabel": "Phone / WhatsApp:",
    "footer.navTitle": "Navigation",
    "footer.admin": "Orders admin",
    "footer.tagline": "Made for North Cyprus",

    "modal.title": "Request sent",
    "modal.text":
      "Thank you! We have received your request and will contact you shortly.",
    "modal.orderId": "Request ID:",
    "modal.ok": "OK",

    "pwa.install": "Install app"
  }
};

function applyTranslations(lang) {
  const dict = translations[lang] || translations.ru;

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    const value = dict[key];
    if (!value) return;
    if (value.includes("<span")) {
      el.innerHTML = value;
    } else {
      el.textContent = value;
    }
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = el.getAttribute("data-i18n-placeholder");
    const value = dict[key];
    if (!value) return;
    el.setAttribute("placeholder", value);
  });
}

function initLang() {
  const select = document.getElementById("langSelect");
  if (!select) return;

  const stored = localStorage.getItem("supTemizLang");
  const initial = stored || "ru";
  select.value = initial;
  applyTranslations(initial);

  select.addEventListener("change", () => {
    const lang = select.value;
    localStorage.setItem("supTemizLang", lang);
    applyTranslations(lang);
  });
}

// Init
document.addEventListener("DOMContentLoaded", () => {
  initNav();
  initQuickForm();
  initOrderForm();
  initModal();
  initYear();
  initWhatsApp();
  initPWAInstall();
  initLang();
  registerServiceWorker();
});
