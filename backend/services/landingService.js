// backend/services/landingService.js - Service complet avec Handlebars et Firebase
const Handlebars = require('handlebars');
const admin = require('firebase-admin');
const db = admin.firestore();

// ==================== IMPORT SERVICE DEEPL ====================
let LanguageService = null;
let languageServiceInstance = null;

try {
  LanguageService = require('./LanguageService');
  languageServiceInstance = new LanguageService();
  console.log('✅ LanguageService DeepL chargé dans landingService');
} catch (error) {
  console.warn('⚠️ LanguageService non disponible:', error.message);
}

// ==================== FONCTION DE TRADUCTION DEEPL DIRECTE ====================
// Utilise fetch natif (Node.js 18+) - pas besoin d'axios
// Détecte automatiquement si c'est une clé PRO ou FREE
async function translateTextsWithDeepL(texts, targetLang, sourceLang = 'FR') {
  const deeplApiKey = process.env.DEEPL_API_KEY;
  
  if (!deeplApiKey) {
    console.warn('⚠️ DEEPL_API_KEY non configurée');
    return texts; // Retourner les originaux
  }
  
  if (!Array.isArray(texts) || texts.length === 0) {
    return [];
  }
  
  // Normaliser les codes de langue
  const normalizedTarget = targetLang.toUpperCase().substring(0, 2);
  const normalizedSource = sourceLang.toUpperCase().substring(0, 2);
  
  // Si même langue, pas besoin de traduire
  if (normalizedTarget === normalizedSource) {
    console.log('ℹ️ Même langue source/cible, pas de traduction');
    return texts;
  }
  
  // Mapper les codes courts vers les codes DeepL
  const langMap = {
    'EN': 'EN',
    'FR': 'FR',
    'ES': 'ES',
    'DE': 'DE',
    'IT': 'IT',
    'PT': 'PT',
    'RU': 'RU',
    'ZH': 'ZH',
    'JA': 'JA',
    'KO': 'KO',
    'TR': 'TR',
    'AR': 'AR',
    'PL': 'PL',
    'NL': 'NL',
    'SV': 'SV',
    'DA': 'DA',
    'NO': 'NB',
    'FI': 'FI'
  };
  
  const deeplTarget = langMap[normalizedTarget] || normalizedTarget;
  const deeplSource = langMap[normalizedSource] || normalizedSource;
  
  // Détecter si c'est une clé FREE ou PRO
  // Les clés FREE se terminent par ":fx"
  const isFreeKey = deeplApiKey.endsWith(':fx');
  const apiEndpoint = isFreeKey 
    ? 'https://api-free.deepl.com/v2/translate'
    : 'https://api.deepl.com/v2/translate';
  
  console.log(`🔑 DeepL API: ${isFreeKey ? 'FREE' : 'PRO'}`);
  
  try {
    // Construire les paramètres
    const params = new URLSearchParams();
    params.append('target_lang', deeplTarget);
    // NE PAS spécifier source_lang - DeepL détecte automatiquement la langue source
    // C'est plus fiable car les utilisateurs peuvent se tromper de langue à la création
    
    for (const text of texts) {
      params.append('text', text || '');
    }
    
    console.log(`🌍 Appel DeepL: AUTO → ${deeplTarget} (${texts.length} textes)`);
    
    // Utiliser fetch natif (Node.js 18+)
    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${deeplApiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DeepL API error ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    const translations = data?.translations?.map(t => t.text) || [];
    
    // S'assurer que la longueur correspond
    while (translations.length < texts.length) {
      translations.push(texts[translations.length]);
    }
    
    console.log('✅ DeepL traduction réussie');
    return translations;
    
  } catch (error) {
    console.error('❌ Erreur DeepL:', error.message);
    return texts; // Fallback vers originaux
  }
}

// ==================== TRADUCTIONS UI POUR 13 LANGUES ====================
const UI_TRANSLATIONS = {
  fr: {
    access: "Accès",
    reviews: "Avis",
    privateChannel: "Canal Telegram privé",
    day: "jour",
    days: "jours",
    week: "semaine",
    month: "mois",
    months: "mois",
    year: "an",
    years: "ans",
    lifetime: "à vie",
    limitedPlaces: "places limitées",
    freeDays: "jours gratuits",
    popular: "populaire",
    joinNow: "Rejoindre maintenant",
    legalNote1: "En vous abonnant, vous acceptez les conditions spécifiques du créateur et la politique de confidentialité.",
    legalNote2: "Votre abonnement est sans engagement, vous pouvez annuler à tout moment.",
    legalNote3: "Pour toute question, vous pouvez contacter le créateur à",
    // Nouveaux éléments traduits
    anonymousUser: "Utilisateur",
    option: "option",
    options: "options",
    noReviews: "Aucun avis pour le moment",
    loading: "Chargement...",
    error: "Erreur",
    selectPlan: "Sélectionner un plan",
    bestValue: "Meilleure offre",
    mostPopular: "Le plus populaire"
  },
  en: {
    access: "Access",
    reviews: "Reviews",
    privateChannel: "Private Telegram Channel",
    day: "day",
    days: "days",
    week: "week",
    month: "month",
    months: "months",
    year: "year",
    years: "years",
    lifetime: "lifetime",
    limitedPlaces: "limited spots",
    freeDays: "free days",
    popular: "popular",
    joinNow: "Join Now",
    legalNote1: "By subscribing, you accept the creator's specific conditions and privacy policy.",
    legalNote2: "Your subscription is non-binding, you can cancel at any time.",
    legalNote3: "For any questions, you can contact the creator at",
    // New translated elements
    anonymousUser: "User",
    option: "option",
    options: "options",
    noReviews: "No reviews yet",
    loading: "Loading...",
    error: "Error",
    selectPlan: "Select a plan",
    bestValue: "Best value",
    mostPopular: "Most popular"
  },
  es: {
    access: "Acceso",
    reviews: "Reseñas",
    privateChannel: "Canal Telegram privado",
    day: "día",
    days: "días",
    week: "semana",
    month: "mes",
    months: "meses",
    year: "año",
    years: "años",
    lifetime: "de por vida",
    limitedPlaces: "plazas limitadas",
    freeDays: "días gratis",
    popular: "popular",
    joinNow: "Únete ahora",
    legalNote1: "Al suscribirte, aceptas las condiciones específicas del creador y la política de privacidad.",
    legalNote2: "Tu suscripción es sin compromiso, puedes cancelar en cualquier momento.",
    legalNote3: "Para cualquier pregunta, puedes contactar al creador en",
    // Nuevos elementos traducidos
    anonymousUser: "Usuario",
    option: "opción",
    options: "opciones",
    noReviews: "Sin reseñas por el momento",
    loading: "Cargando...",
    error: "Error",
    selectPlan: "Seleccionar un plan",
    bestValue: "Mejor valor",
    mostPopular: "Más popular"
  },
  pt: {
    access: "Acesso",
    reviews: "Avaliações",
    privateChannel: "Canal Telegram privado",
    day: "dia",
    days: "dias",
    week: "semana",
    month: "mês",
    months: "meses",
    year: "ano",
    years: "anos",
    lifetime: "vitalício",
    limitedPlaces: "vagas limitadas",
    freeDays: "dias grátis",
    popular: "popular",
    joinNow: "Junte-se agora",
    legalNote1: "Ao se inscrever, você aceita as condições específicas do criador e a política de privacidade.",
    legalNote2: "Sua assinatura é sem compromisso, você pode cancelar a qualquer momento.",
    legalNote3: "Para qualquer dúvida, você pode entrar em contato com o criador em",
    // Novos elementos traduzidos
    anonymousUser: "Usuário",
    option: "opção",
    options: "opções",
    noReviews: "Nenhuma avaliação ainda",
    loading: "Carregando...",
    error: "Erro",
    selectPlan: "Selecionar um plano",
    bestValue: "Melhor valor",
    mostPopular: "Mais popular"
  },
  de: {
    access: "Zugang",
    reviews: "Bewertungen",
    privateChannel: "Privater Telegram-Kanal",
    day: "Tag",
    days: "Tage",
    week: "Woche",
    month: "Monat",
    months: "Monate",
    year: "Jahr",
    years: "Jahre",
    lifetime: "lebenslang",
    limitedPlaces: "begrenzte Plätze",
    freeDays: "Tage kostenlos",
    popular: "beliebt",
    joinNow: "Jetzt beitreten",
    legalNote1: "Mit dem Abonnement akzeptieren Sie die spezifischen Bedingungen des Erstellers und die Datenschutzrichtlinie.",
    legalNote2: "Ihr Abonnement ist unverbindlich, Sie können jederzeit kündigen.",
    legalNote3: "Bei Fragen können Sie den Ersteller kontaktieren unter",
    // Neue übersetzte Elemente
    anonymousUser: "Benutzer",
    option: "Option",
    options: "Optionen",
    noReviews: "Noch keine Bewertungen",
    loading: "Laden...",
    error: "Fehler",
    selectPlan: "Plan auswählen",
    bestValue: "Bester Wert",
    mostPopular: "Am beliebtesten"
  },
  it: {
    access: "Accesso",
    reviews: "Recensioni",
    privateChannel: "Canale Telegram privato",
    day: "giorno",
    days: "giorni",
    week: "settimana",
    month: "mese",
    months: "mesi",
    year: "anno",
    years: "anni",
    lifetime: "a vita",
    limitedPlaces: "posti limitati",
    freeDays: "giorni gratis",
    popular: "popolare",
    joinNow: "Iscriviti ora",
    legalNote1: "Iscrivendoti, accetti le condizioni specifiche del creatore e l'informativa sulla privacy.",
    legalNote2: "Il tuo abbonamento è senza impegno, puoi annullare in qualsiasi momento.",
    legalNote3: "Per qualsiasi domanda, puoi contattare il creatore a",
    // Nuovi elementi tradotti
    anonymousUser: "Utente",
    option: "opzione",
    options: "opzioni",
    noReviews: "Nessuna recensione ancora",
    loading: "Caricamento...",
    error: "Errore",
    selectPlan: "Seleziona un piano",
    bestValue: "Miglior valore",
    mostPopular: "Più popolare"
  },
  ru: {
    access: "Доступ",
    reviews: "Отзывы",
    privateChannel: "Приватный Telegram-канал",
    day: "день",
    days: "дней",
    week: "неделя",
    month: "месяц",
    months: "месяцев",
    year: "год",
    years: "лет",
    lifetime: "навсегда",
    limitedPlaces: "ограниченные места",
    freeDays: "бесплатных дней",
    popular: "популярный",
    joinNow: "Присоединиться",
    legalNote1: "Подписываясь, вы принимаете особые условия создателя и политику конфиденциальности.",
    legalNote2: "Ваша подписка без обязательств, вы можете отменить в любое время.",
    legalNote3: "По любым вопросам вы можете связаться с создателем по адресу",
    // Новые переведенные элементы
    anonymousUser: "Пользователь",
    option: "вариант",
    options: "варианты",
    noReviews: "Пока нет отзывов",
    loading: "Загрузка...",
    error: "Ошибка",
    selectPlan: "Выбрать план",
    bestValue: "Лучшая цена",
    mostPopular: "Самый популярный"
  },
  zh: {
    access: "访问",
    reviews: "评价",
    privateChannel: "私人Telegram频道",
    day: "天",
    days: "天",
    week: "周",
    month: "月",
    months: "个月",
    year: "年",
    years: "年",
    lifetime: "终身",
    limitedPlaces: "名额有限",
    freeDays: "天免费",
    popular: "热门",
    joinNow: "立即加入",
    legalNote1: "订阅即表示您接受创作者的特定条款和隐私政策。",
    legalNote2: "您的订阅无约束力，可随时取消。",
    legalNote3: "如有任何问题，您可以联系创作者",
    // 新翻译元素
    anonymousUser: "用户",
    option: "选项",
    options: "选项",
    noReviews: "暂无评价",
    loading: "加载中...",
    error: "错误",
    selectPlan: "选择计划",
    bestValue: "最佳价值",
    mostPopular: "最受欢迎"
  },
  ja: {
    access: "アクセス",
    reviews: "レビュー",
    privateChannel: "プライベートTelegramチャンネル",
    day: "日",
    days: "日間",
    week: "週間",
    month: "ヶ月",
    months: "ヶ月",
    year: "年",
    years: "年間",
    lifetime: "永久",
    limitedPlaces: "限定枠",
    freeDays: "日間無料",
    popular: "人気",
    joinNow: "今すぐ参加",
    legalNote1: "購読することで、クリエイターの特定条件とプライバシーポリシーに同意したことになります。",
    legalNote2: "購読は拘束力がなく、いつでもキャンセルできます。",
    legalNote3: "ご質問は、クリエイターまでお問い合わせください",
    // 新しい翻訳要素
    anonymousUser: "ユーザー",
    option: "オプション",
    options: "オプション",
    noReviews: "まだレビューはありません",
    loading: "読み込み中...",
    error: "エラー",
    selectPlan: "プランを選択",
    bestValue: "最高の価値",
    mostPopular: "最も人気"
  },
  ko: {
    access: "접근",
    reviews: "리뷰",
    privateChannel: "비공개 텔레그램 채널",
    day: "일",
    days: "일",
    week: "주",
    month: "개월",
    months: "개월",
    year: "년",
    years: "년",
    lifetime: "평생",
    limitedPlaces: "한정 자리",
    freeDays: "일 무료",
    popular: "인기",
    joinNow: "지금 가입",
    legalNote1: "구독하시면 크리에이터의 특정 조건과 개인정보 보호정책에 동의하게 됩니다.",
    legalNote2: "구독은 구속력이 없으며 언제든지 취소할 수 있습니다.",
    legalNote3: "질문이 있으시면 크리에이터에게 연락하세요",
    // 새로 번역된 요소
    anonymousUser: "사용자",
    option: "옵션",
    options: "옵션",
    noReviews: "아직 리뷰가 없습니다",
    loading: "로딩 중...",
    error: "오류",
    selectPlan: "플랜 선택",
    bestValue: "최고의 가치",
    mostPopular: "가장 인기"
  },
  tr: {
    access: "Erişim",
    reviews: "Yorumlar",
    privateChannel: "Özel Telegram Kanalı",
    day: "gün",
    days: "gün",
    week: "hafta",
    month: "ay",
    months: "ay",
    year: "yıl",
    years: "yıl",
    lifetime: "ömür boyu",
    limitedPlaces: "sınırlı kontenjan",
    freeDays: "gün ücretsiz",
    popular: "popüler",
    joinNow: "Şimdi Katıl",
    legalNote1: "Abone olarak, içerik oluşturucunun özel koşullarını ve gizlilik politikasını kabul etmiş olursunuz.",
    legalNote2: "Aboneliğiniz bağlayıcı değildir, istediğiniz zaman iptal edebilirsiniz.",
    legalNote3: "Sorularınız için içerik oluşturucuyla iletişime geçebilirsiniz",
    // Yeni çevrilmiş öğeler
    anonymousUser: "Kullanıcı",
    option: "seçenek",
    options: "seçenek",
    noReviews: "Henüz yorum yok",
    loading: "Yükleniyor...",
    error: "Hata",
    selectPlan: "Plan seç",
    bestValue: "En iyi değer",
    mostPopular: "En popüler"
  },
  ar: {
    access: "الوصول",
    reviews: "التقييمات",
    privateChannel: "قناة تيليجرام خاصة",
    day: "يوم",
    days: "أيام",
    week: "أسبوع",
    month: "شهر",
    months: "أشهر",
    year: "سنة",
    years: "سنوات",
    lifetime: "مدى الحياة",
    limitedPlaces: "أماكن محدودة",
    freeDays: "أيام مجانية",
    popular: "شائع",
    joinNow: "انضم الآن",
    legalNote1: "بالاشتراك، فإنك توافق على الشروط الخاصة للمنشئ وسياسة الخصوصية.",
    legalNote2: "اشتراكك غير ملزم، يمكنك الإلغاء في أي وقت.",
    legalNote3: "لأي أسئلة، يمكنك الاتصال بالمنشئ على",
    // عناصر مترجمة جديدة
    anonymousUser: "مستخدم",
    option: "خيار",
    options: "خيارات",
    noReviews: "لا توجد تقييمات بعد",
    loading: "جاري التحميل...",
    error: "خطأ",
    selectPlan: "اختر خطة",
    bestValue: "أفضل قيمة",
    mostPopular: "الأكثر شعبية"
  },
  pl: {
    access: "Dostęp",
    reviews: "Opinie",
    privateChannel: "Prywatny kanał Telegram",
    day: "dzień",
    days: "dni",
    week: "tydzień",
    month: "miesiąc",
    months: "miesięcy",
    year: "rok",
    years: "lat",
    lifetime: "dożywotnio",
    limitedPlaces: "ograniczone miejsca",
    freeDays: "dni bezpłatnie",
    popular: "popularny",
    joinNow: "Dołącz teraz",
    legalNote1: "Subskrybując, akceptujesz szczegółowe warunki twórcy i politykę prywatności.",
    legalNote2: "Twoja subskrypcja jest niewiążąca, możesz ją anulować w dowolnym momencie.",
    legalNote3: "W przypadku pytań możesz skontaktować się z twórcą pod adresem",
    // Nowe przetłumaczone elementy
    anonymousUser: "Użytkownik",
    option: "opcja",
    options: "opcje",
    noReviews: "Brak opinii",
    loading: "Ładowanie...",
    error: "Błąd",
    selectPlan: "Wybierz plan",
    bestValue: "Najlepsza wartość",
    mostPopular: "Najpopularniejszy"
  }
};

// Fonction helper pour obtenir les traductions UI - ANGLAIS PAR DÉFAUT
function getUITranslations(lang) {
  const normalizedLang = (lang || 'en').toLowerCase().substring(0, 2);
  return UI_TRANSLATIONS[normalizedLang] || UI_TRANSLATIONS['en'];
}

// ==================== FONCTIONS UTILITAIRES DE SÉCURITÉ ====================

// --- MINI OUTILS SÛRS ---
function isHexColor(v){
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(v||''));
}

function clampRating(r){
  const n = Math.round(Number(r)||0);
  return Math.min(5, Math.max(0,n));
}

// description -> liste/texte simple, en échappant tout HTML
function formatDescriptionSafe(text) {
  if (!text) return '';
  const esc = s => String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  const lines = String(text).split('\n').filter(l => l.trim());
  const isBullet   = lines.every(l => l.startsWith('• '));
  const isNumbered = lines.every(l => /^\d+\.\s/.test(l));
  const isArrow    = lines.every(l => l.startsWith('➤ '));
  if (isBullet)   return `<ul style="margin: 0; padding-left: 20px;">${lines.map(l=>`<li>${esc(l.slice(2).trim())}</li>`).join('')}</ul>`;
  if (isNumbered) return `<ol style="margin: 0; padding-left: 20px;">${lines.map(l=>`<li>${esc(l.replace(/^\d+\.\s/, '').trim())}</li>`).join('')}</ol>`;
  if (isArrow)    return lines.map(l=>`<div style="margin-bottom: 8px;">➤ ${esc(l.slice(2).trim())}</div>`).join('');
  return esc(text).replace(/\n/g,'<br>');
}

/**
 * Échapper les caractères HTML pour éviter les injections XSS
 */
function esc(s = '') {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Obtenir le label de période formaté avec traduction - ANGLAIS PAR DÉFAUT
 */
function periodLabel(period = 'month', lang = 'en') {
  const t = getUITranslations(lang);
  const p = String(period).toLowerCase();
  
  // Mapping complet des périodes
  const periodMap = {
    'daily': t.day,
    'jour': t.day,
    'day': t.day,
    'weekly': t.week,
    'semaine': t.week,
    'week': t.week,
    'monthly': t.month,
    'mois': t.month,
    'month': t.month,
    'quarterly': `3 ${t.months}`,
    '3mois': `3 ${t.months}`,
    '3months': `3 ${t.months}`,
    'trimestre': `3 ${t.months}`,
    'quarter': `3 ${t.months}`,
    'yearly': t.year,
    'an': t.year,
    'année': t.year,
    'year': t.year,
    'annual': t.year,
    'lifetime': t.lifetime,
    'àvie': t.lifetime,
    'life': t.lifetime
  };
  
  return periodMap[p] || p;
}

/**
 * Valider et sécuriser une URL
 */
function safeUrl(u = '') {
  try {
    const url = new URL(u, 'https://example.com'); // base pour relatives
    if (!/^https?:$/i.test(url.protocol)) return '';
    return url.href.replace('https://example.com', ''); // garder relatives telles quelles
  } catch {
    return '';
  }
}

// ==================== CONFIGURATION ====================
// Mapping symbole vers code ISO
const SYMBOL_TO_CODE = {
  '€': 'EUR',
  '$': 'USD',
  '£': 'GBP',
  'CHF': 'CHF',
  'Fr': 'CHF',
  'د.إ': 'AED',
  'AED': 'AED',
  '﷼': 'SAR',
  'SAR': 'SAR',
  '₪': 'ILS',
  'ILS': 'ILS',
  'MAD': 'MAD',
  'DH': 'MAD',
  '¥': 'JPY',
  'C$': 'CAD',
  'A$': 'AUD',
  'kr': 'SEK',
  'NZ$': 'NZD',
  'S$': 'SGD',
  'HK$': 'HKD',
  '₩': 'KRW',
  '₹': 'INR',
  '₽': 'RUB',
  'R$': 'BRL',
  'R': 'ZAR'
};

// ==================== HELPERS HANDLEBARS ====================
let helpersRegistered = false;

function registerHelpers() {
  if (helpersRegistered) return;
  
  // Helpers de base
  Handlebars.registerHelper('safe', s => new Handlebars.SafeString(s || ''));
  Handlebars.registerHelper('eq', (a, b) => a === b);
  Handlebars.registerHelper('gt', (a, b) => Number(a) > Number(b));
  Handlebars.registerHelper('substring', (str, start, len) => {
    if (str == null) return '';
    const s = String(str);
    return s.substring(Number(start), Number(start) + Number(len));
  });
  
  // Helpers SEO
  Handlebars.registerHelper('stripTags', s => (s || '').toString().replace(/<[^>]*>/g, ''));
  Handlebars.registerHelper('truncate', (s, n) => (s || '').toString().slice(0, n || 160));
  Handlebars.registerHelper('encode', s => encodeURIComponent((s || '').toString()).replace(/%20/g, '+'));
  
  // Helper monétaire
  Handlebars.registerHelper('money', (price, currency = '€') => {
    const val = Number(price || 0);
    return `${val % 1 === 0 ? val.toFixed(0) : val.toFixed(2)}${currency}`;
  });
  
  helpersRegistered = true;
}

// ==================== FONCTIONS DE NORMALISATION ====================
/**
 * Normaliser les prix avec structure complète - ANGLAIS PAR DÉFAUT
 */
function normalizePrices(pricesRaw, lang = 'en') {
  const arr = Array.isArray(pricesRaw) ? pricesRaw : [];
  const t = getUITranslations(lang);
  
  if (!arr.length) {
    // Prix par défaut
    return [
      { 
        id: 'p1', 
        label: `67€ / ${t.month}`, 
        price: 67, 
        period: 'mois', 
        currency: '€',
        currencyCode: 'EUR',
        best: false,
        limitedSeats: true, 
        freeTrialDays: 7 
      },
      { 
        id: 'p2', 
        label: `197€ / 3 ${t.months}`, 
        price: 197, 
        period: '3mois', 
        currency: '€',
        currencyCode: 'EUR', 
        best: false,
        strike: '201€',
        discount: '-2%',
        limitedSeats: true, 
        freeTrialDays: 7 
      },
      { 
        id: 'p3', 
        label: `497€ / ${t.year}`, 
        price: 497, 
        period: 'an', 
        currency: '€',
        currencyCode: 'EUR', 
        best: true,
        strike: '804€',
        discount: '-38%',
        limitedSeats: true, 
        freeTrialDays: 7 
      }
    ];
  }
  
  return arr.map((p, i) => {
    // Sécuriser le prix avec clamp
    const rawPrice = Number(p.price ?? p.amount ?? 0);
    const price = Number.isFinite(rawPrice) && rawPrice >= 0 ? rawPrice : 0;
    
    const period = (p.period || 'mois').toLowerCase();
    
    // Accepter n'importe quel symbole de devise sans validation
    const currency = p.currency || '€';
    
    // Dériver le code ISO si non fourni
    const currencyCode = p.currencyCode || SYMBOL_TO_CODE[currency] || 'EUR';
    
    const periodText = periodLabel(period, lang);
    
    // Si un label personnalisé existe, traduire les termes de période dedans
    let label = p.label || `${price}${currency} / ${periodText}`;
    
    // Traduire les périodes dans le label personnalisé
    if (p.label && lang !== 'fr') {
      const t = getUITranslations(lang);
      // Remplacer les termes français par la traduction
      label = label
        .replace(/\/ mois/gi, `/ ${t.month}`)
        .replace(/\/ semaine/gi, `/ ${t.week}`)
        .replace(/\/ an\b/gi, `/ ${t.year}`)
        .replace(/\/ année/gi, `/ ${t.year}`)
        .replace(/\/ jour/gi, `/ ${t.day}`)
        .replace(/\/ trimestre/gi, `/ 3 ${t.months}`)
        .replace(/\/ 3 mois/gi, `/ 3 ${t.months}`)
        .replace(/\/ 6 mois/gi, `/ 6 ${t.months}`)
        .replace(/\/ 12 mois/gi, `/ 12 ${t.months}`)
        // Support anglais aussi
        .replace(/\/ month/gi, `/ ${t.month}`)
        .replace(/\/ week/gi, `/ ${t.week}`)
        .replace(/\/ year/gi, `/ ${t.year}`)
        .replace(/\/ day/gi, `/ ${t.day}`)
        .replace(/\/ 3 months/gi, `/ 3 ${t.months}`)
        .replace(/\/ 6 months/gi, `/ 6 ${t.months}`)
        .replace(/\/ 12 months/gi, `/ 12 ${t.months}`);
    }
    
    // Sécuriser freeTrialDays avec clamp
    const ftd = Number(p.freeTrialDays);
    const freeTrialDays = Number.isFinite(ftd) ? Math.max(0, Math.min(90, Math.floor(ftd))) : 7;
    
    // Ajouter le support pour limitedSpots
    const limitedSpots = Number(p.limitedSpots) || 0;
    
    return {
      id: p.id || p.planId || `p${i + 1}`,
      label,
      price,
      period,
      currency,
      currencyCode,
      best: Boolean(p.best),
      strike: p.strike || '',
      discount: p.discount || '',
      limitedSeats: p.limitedSeats !== false,
      limitedSpots: limitedSpots, // Ajout du nombre de places
      freeTrialDays
    };
  });
}

/**
 * Convertir hex en rgba avec opacité
 */
function hexToRgba(hex, alpha = 0.12) {
  if (!hex) return `rgba(0,0,0,${alpha})`;
  const c = hex.replace('#', '');
  const bigint = parseInt(c.length === 3 ? c.split('').map(x => x + x).join('') : c, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * Préparer les métadonnées SEO
 */
function prepareSEOData(data) {
  // Meta description sécurisée
  const plainDesc = (data.description || data.slogan || '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  data.metaDescription = plainDesc.slice(0, 160);
  
  // Font Google encodée
  const fontMap = {
    'inter': 'Inter',
    'poppins': 'Poppins',
    'montserrat': 'Montserrat',
    'playfair': 'Playfair+Display',
    'playfair display': 'Playfair+Display',
    'work sans': 'Work+Sans',
    'merriweather': 'Merriweather',
    'nunito': 'Nunito',
    'dm sans': 'DM+Sans'
  };
  
  const fontKey = (data.font || 'inter').toLowerCase();
  data.fontGoogle = fontMap[fontKey] || 'Inter';
  data.fontFamily = data.fontFamily || `${data.fontGoogle.replace('+', ' ')}, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
}

/**
 * Calculer la couleur de fond de la description
 */
function computeDescriptionBg(data) {
  const enabled = Boolean(
    data.descriptionBackgroundEnabled ?? 
    data.descriptionBackground === true
  );
  
  if (!enabled) return { enabled: false, color: '' };
  
  const color = data.descriptionBackgroundColor || hexToRgba(data.borderColor || '#333', 0.12);
  
  return { enabled: true, color };
}

// ==================== FONCTIONS UTILITAIRES ====================
/**
 * Calcule automatiquement la couleur de texte contrastée
 */
function autoContrast(hex) {
  const c = (hex || '').replace('#','');
  if (c.length !== 6) return '#ffffff';
  const r = parseInt(c.substr(0,2),16);
  const g = parseInt(c.substr(2,2),16);
  const b = parseInt(c.substr(4,2),16);
  const yiq = (r*299 + g*587 + b*114) / 1000;
  return yiq >= 128 ? '#000000' : '#ffffff';
}

/**
 * Devine le type de média à partir de l'URL
 */
function guessTypeFromUrl(url = '') {
  const ext = url.split('?')[0].split('.').pop().toLowerCase();
  if (['mp4','webm','ogg'].includes(ext)) return 'video';
  if (['jpg','jpeg','png','gif','webp','avif'].includes(ext)) return 'image';
  return 'image';
}

// ==================== CONSTRUCTION DES SECTIONS ====================
/**
 * Construire la section média (images/vidéos)
 */
function buildMediaSection(media = []) {
  if (!Array.isArray(media) || media.length === 0) return '';
  
  const items = media.map(m => {
    const url = safeUrl(m.url || m.src || '');
    if (!url) return '';
    
    const type = m.type || guessTypeFromUrl(url);
    
    if (type === 'video') {
      return `<video src="${esc(url)}" controls playsinline preload="metadata" style="width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:14px;box-shadow:0 2px 10px rgba(0,0,0,.12)"></video>`;
    }
    return `<img src="${esc(url)}" alt="" loading="lazy" decoding="async" style="width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:14px;box-shadow:0 2px 10px rgba(0,0,0,.12)" />`;
  }).join('');

  return `<div class="media-gallery">${items}</div>`;
}

/**
 * Construire la section reviews/avis avec traduction - ANGLAIS PAR DÉFAUT
 */
function buildReviewsSection(reviews = [], lang = 'en') {
  if (!Array.isArray(reviews) || reviews.length === 0) return '';

  const t = getUITranslations(lang);
  const avg = Math.round(
    (reviews.reduce((s, r) => s + clampRating(r.rating), 0) / reviews.length) * 10
  ) / 10;

  const list = reviews.map(r => {
    const rating = clampRating(r.rating);
    const safeComment = esc(r.comment || '').replace(/\n/g,'<br>');
    // CORRECTION: Utiliser la traduction pour l'utilisateur anonyme
    const safeAuthor  = esc(r.author || r.customerName || r.name || t.anonymousUser);
    return `
      <div class="review-card">
        <div class="review-header">
          <i class="fas fa-user-circle review-avatar"></i>
          <div>
            <div class="review-author">${safeAuthor}</div>
            <div class="review-stars">${'★'.repeat(rating)}<span style="color:#ddd;">${'★'.repeat(5-rating)}</span></div>
          </div>
        </div>
        <div class="review-comment">${safeComment}</div>
      </div>`;
  }).join('');

  return `
    <div class="reviews-section">
      <h2>${t.reviews}</h2>
      <div class="review-summary">
        <div class="review-stars-large">${'★'.repeat(Math.round(avg))}<span style="color:#ddd;">${'★'.repeat(5-Math.round(avg))}</span></div>
        <div class="review-count">${avg} (${reviews.length})</div>
      </div>
      ${list}
    </div>`;
}

/**
 * Construire la section prix avec traductions - ANGLAIS PAR DÉFAUT
 */
function buildPriceSection(data, lang = 'en') {
  const t = getUITranslations(lang);
  const prices = data.prices || [];
  const slug = data.slug || '';
  const borderColor = data.borderColor || '#333';
  const btnTextColor = data.btnTextColor || autoContrast(borderColor);
  const buttonText = data.buttonText || t.joinNow;
  
  if (!data.showPrices || !prices.length) return '';

  // Prix sélectionné par défaut
  const defaultPrice = prices.find(p => p.best) || prices[0];
  
  // Construire les options pour desktop
  const desktopOptions = prices.map((plan, index) => {
    const isSelected = plan.best || index === 0 ? 'selected' : '';
    const isPopular = plan.best || plan.isPopular;
    
    let optionInfo = '';
    if (plan.limitedSeats && plan.limitedSpots > 0) {
      optionInfo += `<span class="option-info-item highlight">${plan.limitedSpots} ${t.limitedPlaces}</span>`;
    } else if (plan.limitedSeats) {
      optionInfo += `<span class="option-info-item highlight">${t.limitedPlaces}</span>`;
    }
    if (plan.freeTrialDays > 0) {
      optionInfo += `<span class="option-info-item">${plan.freeTrialDays} ${t.freeDays}</span>`;
    }
    
    // Badge Popular en haut à droite
    const popularBadge = isPopular ? `<span class="popular-badge">⭐ ${t.mostPopular}</span>` : '';
    
    return `
      <div class="price-option ${isSelected} ${isPopular ? 'is-popular' : ''}" data-plan-id="${esc(plan.id)}">
        ${popularBadge}
        <div class="price-main-row">
          <span class="left">${esc(plan.label)}</span>
          <div class="right">
            ${plan.strike ? `<span class="price-strike">${esc(plan.strike)}</span>` : ''}
            ${plan.discount ? `<span class="discount-badge">${esc(plan.discount)}</span>` : ''}
          </div>
        </div>
        ${optionInfo ? `<div class="option-info">${optionInfo}</div>` : ''}
      </div>
    `;
  }).join('');

  // Construire les options pour mobile
  const mobileOptions = prices.map((plan, index) => {
    const isSelected = index === 0 ? 'selected' : '';
    const isPopular = plan.best || plan.isPopular;
    
    let optionInfo = '';
    if (plan.limitedSeats && plan.limitedSpots > 0) {
      optionInfo += `<span class="mobile-option-info-item highlight">${plan.limitedSpots} ${t.limitedPlaces}</span>`;
    } else if (plan.limitedSeats) {
      optionInfo += `<span class="mobile-option-info-item highlight">${t.limitedPlaces}</span>`;
    }
    if (plan.freeTrialDays > 0) {
      optionInfo += `<span class="mobile-option-info-item">${plan.freeTrialDays} ${t.freeDays}</span>`;
    }
    
    // Badge Popular en haut à droite
    const popularBadge = isPopular ? `<span class="popular-badge">⭐ ${t.mostPopular}</span>` : '';
    
    return `
      <div class="mobile-option ${isSelected} ${isPopular ? 'is-popular' : ''}" data-plan-id="${esc(plan.id)}">
        ${popularBadge}
        <div class="mobile-option-main">
          <span class="left">${esc(plan.label)}</span>
          <div class="right">
            ${plan.strike ? `<span class="price-strike">${esc(plan.strike)}</span>` : '<span style="visibility: hidden;">-</span>'}
            ${plan.discount ? `<span class="discount-badge">${esc(plan.discount)}</span>` : ''}
          </div>
        </div>
        ${optionInfo ? `<div class="mobile-option-info">${optionInfo}</div>` : ''}
      </div>
    `;
  }).join('');

  // Toggle info pour mobile
  let toggleInfo = '';
  if (defaultPrice.limitedSeats && defaultPrice.limitedSpots > 0) {
    toggleInfo += `<span class="toggle-info-item highlight">${defaultPrice.limitedSpots} ${t.limitedPlaces}</span>`;
  } else if (defaultPrice.limitedSeats) {
    toggleInfo += `<span class="toggle-info-item highlight">${t.limitedPlaces}</span>`;
  }
  if (defaultPrice.freeTrialDays > 0) {
    toggleInfo += `<span class="toggle-info-item">${defaultPrice.freeTrialDays} ${t.freeDays}</span>`;
  }

  const optionCount = prices.length > 1 ? prices.length - 1 : 0;
  // CORRECTION: Utiliser les traductions pour option/options
  const optionText = optionCount > 1 ? t.options : t.option;

  return `
    <!-- Section prix fixe en bas à droite -->
    <div class="price-section-fixed">
      <!-- Version Desktop -->
      <div class="desktop-version">
        <div class="price-card-fixed">
          ${desktopOptions}
          <button class="cta-button" id="desktopCta">
            ${esc(buttonText)}
          </button>
        </div>
      </div>

      <!-- Version Mobile -->
      <div class="mobile-version">
        <div class="mobile-container-fixed">
          <div class="options-section">
            <div class="options-toggle" id="mobileToggle">
              <div class="toggle-left">
                <span class="toggle-price" id="selectedPriceLabel">${esc(defaultPrice.label)}</span>
                ${toggleInfo ? `<div class="toggle-info">${toggleInfo}</div>` : ''}
              </div>
              ${optionCount > 0 ? `<span class="toggle-options">${optionCount} ${optionText}</span>` : ''}
            </div>
            
            <div class="options-panel" id="optionsPanel">
              ${mobileOptions}
            </div>
          </div>
          
          <button class="mobile-cta" id="mobileCta">
            ${esc(buttonText)}
          </button>
        </div>
      </div>
    </div>

    <style>
      /* Container principal - DIRECTEMENT VISIBLE ET AJUSTÉ */
      .price-section-fixed {
        position: fixed;
        bottom: 15px;
        right: 15px;
        z-index: 9999;
      }

      /* VERSION DESKTOP - CARTE TOUJOURS VISIBLE ET LÉGÈREMENT PLUS GRANDE */
      .desktop-version {
        display: block;
      }

      .mobile-version {
        display: none;
      }

      .price-card-fixed {
        background: white;
        border: 2px solid #e0e0e0;
        border-radius: 16px;
        padding: 18px;
        width: 320px;
        box-shadow: 0 8px 30px rgba(0,0,0,0.12);
        animation: slideInUp 0.4s ease-out;
      }

      @keyframes slideInUp {
        from {
          transform: translateY(100px);
          opacity: 0;
        }
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }

      .price-option {
        display: flex;
        flex-direction: column;
        margin-bottom: 10px;
        padding: 14px 18px;
        border-radius: 12px;
        cursor: pointer;
        position: relative;
        transition: all 0.2s;
        border: 2px solid #e0e0e0;
      }

      .price-option:hover {
        border-color: ${borderColor};
        transform: scale(1.02);
      }

      .price-option.selected {
        border-color: ${borderColor};
        background: #f9f9f9;
      }

      .price-option.selected::before {
        content: "";
        position: absolute;
        left: 14px;
        top: 50%;
        transform: translateY(-50%);
        width: 16px;
        height: 16px;
        background: ${borderColor};
        border-radius: 50%;
      }

      .price-main-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 5px;
      }

      .price-option .left {
        font-weight: 600;
        font-size: 16px;
        padding-left: 28px;
        color: #333;
      }

      .price-option .right {
        display: flex;
        gap: 8px;
        align-items: center;
      }

      .price-strike {
        text-decoration: line-through;
        color: #999;
        font-size: 13px;
      }

      .discount-badge {
        background: ${borderColor};
        color: ${btnTextColor};
        padding: 4px 10px;
        border-radius: 6px;
        font-weight: bold;
        font-size: 12px;
      }

      /* Popular Badge - Bandeau en haut à droite */
      .popular-badge {
        position: absolute;
        top: -8px;
        right: 10px;
        background: linear-gradient(135deg, #f59e0b, #d97706);
        color: white;
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 11px;
        font-weight: bold;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        box-shadow: 0 2px 8px rgba(245, 158, 11, 0.4);
        z-index: 10;
        white-space: nowrap;
      }
      
      .price-option.is-popular,
      .mobile-option.is-popular {
        position: relative;
        border: 2px solid #f59e0b !important;
        background: linear-gradient(135deg, rgba(245, 158, 11, 0.05), rgba(217, 119, 6, 0.05));
      }
      
      .price-option.is-popular::before,
      .mobile-option.is-popular::before {
        border-color: #f59e0b !important;
      }

      .option-info {
        display: flex;
        gap: 10px;
        padding-left: 44px;
        font-size: 11px;
      }

      .option-info-item {
        color: #333;
        font-weight: 600;
      }

      .cta-button {
        background: ${borderColor};
        color: ${btnTextColor};
        border: none;
        padding: 14px 28px;
        border-radius: 50px;
        font-size: 15px;
        font-weight: bold;
        cursor: pointer;
        width: 100%;
        transition: all 0.3s ease;
        margin-top: 10px;
        box-shadow: 0 3px 12px rgba(0,0,0,0.15);
      }

      .cta-button:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(0,0,0,0.25);
      }

      /* VERSION MOBILE - COMPACTE */
      .mobile-container-fixed {
        background: white;
        border-radius: 16px;
        padding: 15px;
        box-shadow: 0 8px 30px rgba(0,0,0,0.12);
        width: 280px;
        animation: slideInUp 0.4s ease-out;
      }

      .mobile-cta {
        background: ${borderColor};
        color: ${btnTextColor};
        border: none;
        padding: 13px;
        border-radius: 50px;
        font-size: 14px;
        font-weight: bold;
        cursor: pointer;
        width: 100%;
        margin-top: 5px;
        box-shadow: 0 3px 12px rgba(0,0,0,0.15);
      }

      .mobile-cta:hover {
        transform: translateY(-2px);
        box-shadow: 0 5px 18px rgba(0,0,0,0.22);
      }

      /* Options toggle */
      .options-section {
        margin: 0;
      }

      .options-toggle {
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 6px 0;
        margin-bottom: 2px;
      }

      .toggle-left {
        display: flex;
        align-items: center;
        gap: 6px;
        flex: 1;
      }

      .toggle-price {
        font-size: 14px;
        font-weight: 600;
        color: #333;
        white-space: nowrap;
      }

      .toggle-info {
        display: flex;
        align-items: center;
        gap: 5px;
        font-size: 10px;
        position: relative;
        top: 1px;
        margin-left: 5px;
      }

      .toggle-info-item {
        color: #333;
        font-weight: 600;
        white-space: nowrap;
      }

      .toggle-options {
        display: flex;
        align-items: center;
        gap: 3px;
        font-size: 12px;
        color: #333 !important;
        white-space: nowrap;
        font-weight: 600;
      }

      .toggle-options::after {
        content: "˄";
        font-size: 13px;
        color: #333 !important;
        transition: transform 0.2s;
        font-weight: normal;
      }

      .options-toggle.active .toggle-options::after {
        content: "˅";
      }

      .options-panel {
        display: none;
        margin-top: 6px;
      }

      .options-panel.active {
        display: block;
      }

      /* Options mobile */
      .mobile-option {
        display: flex;
        flex-direction: column;
        margin-bottom: 10px;
        padding: 13px;
        border-radius: 11px;
        cursor: pointer;
        position: relative;
        transition: all 0.2s;
        border: 2px solid #e0e0e0;
        background: white;
      }

      .mobile-option:hover {
        border-color: ${borderColor};
      }

      .mobile-option.selected {
        border-color: ${borderColor};
        background: #f9f9f9;
      }

      .mobile-option.selected::before {
        content: "";
        position: absolute;
        left: 12px;
        top: 50%;
        transform: translateY(-50%);
        width: 14px;
        height: 14px;
        background: ${borderColor};
        border-radius: 50%;
      }

      .mobile-option-main {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 4px;
      }

      .mobile-option .left {
        font-weight: 600;
        font-size: 14px;
        padding-left: 26px;
        color: #333;
      }

      .mobile-option .right {
        display: flex;
        gap: 6px;
        align-items: center;
      }

      .mobile-option .price-strike {
        text-decoration: line-through;
        color: #999;
        font-size: 12px;
      }

      .mobile-option .discount-badge {
        background: ${borderColor};
        color: ${btnTextColor};
        padding: 3px 7px;
        border-radius: 5px;
        font-weight: bold;
        font-size: 11px;
      }

      .mobile-option-info {
        display: flex;
        gap: 8px;
        padding-left: 40px;
        font-size: 10px;
      }

      .mobile-option-info-item {
        color: #333;
        font-weight: 600;
      }

      /* Responsive */
      @media (max-width: 768px) {
        .price-section-fixed {
          bottom: 12px;
          right: 12px;
        }

        .desktop-version {
          display: none;
        }

        .mobile-version {
          display: block;
        }

        .mobile-container-fixed {
          width: calc(100vw - 35px);
          max-width: 280px;
        }
      }

      @media (max-width: 480px) {
        .price-section-fixed {
          bottom: 8px;
          right: 8px;
        }

        .mobile-container-fixed {
          width: calc(100vw - 25px);
        }
      }
    </style>

    <script>
      (function() {
        'use strict';
        
        window.LandingPricing = {
          selectedPlanId: '${defaultPrice.id}',
          slug: '${slug}',
          
          init: function() {
            var self = this;
            
            // Attendre que le DOM soit chargé
            if (document.readyState === 'loading') {
              document.addEventListener('DOMContentLoaded', function() {
                self.bindEvents();
              });
            } else {
              self.bindEvents();
            }
          },
          
          bindEvents: function() {
            var self = this;
            
            // Toggle mobile
            var mobileToggle = document.getElementById('mobileToggle');
            if (mobileToggle) {
              mobileToggle.addEventListener('click', function() {
                self.toggleMobileOptions();
              });
            }
            
            // Boutons CTA
            var desktopCta = document.getElementById('desktopCta');
            if (desktopCta) {
              desktopCta.addEventListener('click', function() {
                self.goToCheckout();
              });
            }
            
            var mobileCta = document.getElementById('mobileCta');
            if (mobileCta) {
              mobileCta.addEventListener('click', function() {
                self.goToCheckout();
              });
            }
            
            // Options desktop
            var priceOptions = document.querySelectorAll('.price-option');
            priceOptions.forEach(function(option) {
              option.addEventListener('click', function() {
                self.selectDesktopOption(this);
              });
            });
            
            // Options mobile
            var mobileOptions = document.querySelectorAll('.mobile-option');
            mobileOptions.forEach(function(option) {
              option.addEventListener('click', function() {
                self.selectMobileOption(this);
              });
            });
          },
          
          toggleMobileOptions: function() {
            var panel = document.getElementById('optionsPanel');
            var toggle = document.getElementById('mobileToggle');
            if (panel && toggle) {
              panel.classList.toggle('active');
              toggle.classList.toggle('active');
            }
          },
          
          selectDesktopOption: function(element) {
            var priceOptions = document.querySelectorAll('.price-option');
            priceOptions.forEach(function(opt) {
              opt.classList.remove('selected');
            });
            element.classList.add('selected');
            this.selectedPlanId = element.getAttribute('data-plan-id');
          },
          
          selectMobileOption: function(element) {
            var self = this;
            var mobileOptions = document.querySelectorAll('.mobile-option');
            mobileOptions.forEach(function(opt) {
              opt.classList.remove('selected');
            });
            element.classList.add('selected');
            
            self.selectedPlanId = element.getAttribute('data-plan-id');
            var label = element.querySelector('.left').textContent;
            var priceLabel = document.getElementById('selectedPriceLabel');
            if (priceLabel) {
              priceLabel.textContent = label;
            }
            
            // Update toggle info
            var info = element.querySelector('.mobile-option-info');
            var toggleInfo = document.querySelector('.toggle-info');
            if (info && toggleInfo) {
              toggleInfo.innerHTML = info.innerHTML;
            }
            
            // Close panel after selection
            setTimeout(function() {
              self.toggleMobileOptions();
            }, 200);
          },
          
          goToCheckout: function() {
            window.location.href = '/checkout/' + this.slug + '?plan=' + encodeURIComponent(this.selectedPlanId);
          }
        };
        
        // Initialiser
        window.LandingPricing.init();
      })();
    </script>
  `;
}

// ==================== FONCTION DE TRADUCTION DEEPL ====================
/**
 * Traduit le contenu d'une landing page avec DeepL
 * @param {Object} data - Données de la landing
 * @param {string} targetLang - Langue cible
 * @param {string} sourceLang - Langue source
 * @returns {Promise<Object>} - Données avec traductions
 */
async function translateLandingContent(data, targetLang, sourceLang = 'en') {
  // Si pas de service de traduction ou même langue, retourner les données telles quelles
  if (!languageServiceInstance) {
    console.log('⚠️ LanguageService non disponible, pas de traduction DeepL');
    return data;
  }
  
  const normalizedTarget = targetLang.toUpperCase().substring(0, 2);
  const normalizedSource = sourceLang.toUpperCase().substring(0, 2);
  
  // Si même langue, pas besoin de traduire
  if (normalizedTarget === normalizedSource) {
    console.log(`ℹ️ Même langue source/cible (${normalizedTarget}), pas de traduction`);
    return data;
  }
  
  // Vérifier si la langue cible est supportée par DeepL
  if (!languageServiceInstance.isSupported(normalizedTarget)) {
    console.log(`⚠️ Langue ${normalizedTarget} non supportée par DeepL`);
    return data;
  }
  
  console.log(`🌍 Traduction DeepL: ${normalizedSource} → ${normalizedTarget}`);
  
  try {
    // Collecter les textes à traduire
    const textsToTranslate = [];
    const fieldKeys = [];
    
    // Champs à traduire
    const translatableFields = ['slogan', 'description', 'buttonText', 'banner'];
    
    for (const field of translatableFields) {
      if (data[field] && typeof data[field] === 'string' && data[field].trim()) {
        textsToTranslate.push(data[field]);
        fieldKeys.push(field);
      }
    }
    
    if (textsToTranslate.length === 0) {
      console.log('ℹ️ Aucun texte à traduire');
      return data;
    }
    
    console.log(`📝 Traduction de ${textsToTranslate.length} champs: ${fieldKeys.join(', ')}`);
    
    // Utiliser translateBatch pour traduire tous les textes en un seul appel
    const translatedTexts = await languageServiceInstance.translateBatch(textsToTranslate, normalizedTarget);
    
    // Appliquer les traductions
    const translatedData = { ...data };
    for (let i = 0; i < fieldKeys.length; i++) {
      if (translatedTexts[i]) {
        translatedData[fieldKeys[i]] = translatedTexts[i];
        console.log(`✅ ${fieldKeys[i]} traduit`);
      }
    }
    
    console.log('🎉 Traduction DeepL terminée avec succès');
    return translatedData;
    
  } catch (error) {
    console.error('❌ Erreur traduction DeepL:', error.message);
    // En cas d'erreur, retourner les données originales
    return data;
  }
}

// ==================== PRESETS DE TEMPLATES ====================
const TEMPLATES = {
  'white-minimal': { backgroundColor:'#ffffff', textColor:'#111111', borderColor:'#111111', btnTextColor:'#ffffff' },
  'ice-crystal': { backgroundColor:'linear-gradient(135deg, #e0f7fa 0%, #b3e5fc 25%, #81d4fa 50%, #4fc3f7 75%, #29b6f6 100%)', textColor:'#1a1a1a', borderColor:'#03a9f4', btnTextColor:'#ffffff' },
  'navy-blue': { backgroundColor:'linear-gradient(135deg, #1e3a8a 0%, #1e40af 25%, #1d4ed8 50%, #2563eb 75%, #3b82f6 100%)', textColor:'#ffffff', borderColor:'#3b82f6', btnTextColor:'#ffffff' },
  'rose-gold': { backgroundColor:'linear-gradient(135deg, #f8bbd9 0%, #e91e63 25%, #ff9800 50%, #ffc107 75%, #ffeb3b 100%)', textColor:'#ffffff', borderColor:'#e91e63', btnTextColor:'#ffffff' },
  'rose-sunset': { backgroundColor:'linear-gradient(135deg, #ff9a9e 0%, #fecfef 25%, #fecfef 50%, #ff9a9e 75%, #f093fb 100%)', textColor:'#ffffff', borderColor:'#f093fb', btnTextColor:'#ffffff' },
  'lava': { backgroundColor:'linear-gradient(45deg, #ff4500, #ff6347, #dc143c, #b22222, #8b0000)', textColor:'#ffffff', borderColor:'#ff4500', btnTextColor:'#ffffff' },
  'neon-mint-classic': { backgroundColor:'linear-gradient(135deg, #00ff88, #00ffcc, #00ffff)', textColor:'#111111', borderColor:'#111111', btnTextColor:'#ffffff' },
  'orchid-bloom': { backgroundColor:'linear-gradient(135deg, #da70d6, #ba55d3, #9370db, #8a2be2)', textColor:'#ffffff', borderColor:'#ba55d3', btnTextColor:'#ffffff' },
  'aurora': { backgroundColor:'linear-gradient(135deg, #00ff87, #60efff, #9d50bb, #6e48aa)', textColor:'#ffffff', borderColor:'#60efff', btnTextColor:'#111111' },
  'sunset': { backgroundColor:'linear-gradient(135deg, #ff9a56, #ffad56, #ff7a00, #ff6b35, #ff5722)', textColor:'#ffffff', borderColor:'#ff6b35', btnTextColor:'#ffffff' },
  'holographic-classic': { backgroundColor:'linear-gradient(45deg, #ff00ff, #00ffff, #ffff00, #ff00ff)', textColor:'#1a1a1a', borderColor:'#ff00ff', btnTextColor:'#ffffff' },
  'metallic-silver': { backgroundColor:'linear-gradient(135deg, #e8e8e8 0%, #c0c0c0 25%, #a8a8a8 50%, #d3d3d3 75%, #f0f0f0 100%)', textColor:'#1a1a1a', borderColor:'#c0c0c0', btnTextColor:'#111111' },
  'nature-harmony': { backgroundColor:'linear-gradient(45deg, #8bc34a, #4caf50, #009688, #00695c)', textColor:'#ffffff', borderColor:'#4caf50', btnTextColor:'#ffffff' },
  'electric-yellow': { backgroundColor:'linear-gradient(45deg, #ffff00, #ffeb3b, #ffd600, #ff8f00)', textColor:'#1a1a1a', borderColor:'#ffff00', btnTextColor:'#111111' },
  'earth-tone': { backgroundColor:'linear-gradient(135deg, #6d4c41, #8d6e63, #a1887f, #795548)', textColor:'#ffffff', borderColor:'#8d6e63', btnTextColor:'#ffffff' },
  'midnight-dark': { backgroundColor:'linear-gradient(135deg, #0f0f23 0%, #1a1a2e 25%, #16213e 50%, #0f3460 75%, #533483 100%)', textColor:'#ffffff', borderColor:'#533483', btnTextColor:'#ffffff' },
  'sakura-bloom': { backgroundColor:'linear-gradient(135deg, #fdf2f8 0%, #fce7f3 20%, #fbcfe8 40%, #f9a8d4 60%, #ec4899 80%)', textColor:'#1a1a1a', borderColor:'#ec4899', btnTextColor:'#ffffff' },
  'forest-green': { backgroundColor:'linear-gradient(135deg, #064e3b 0%, #065f46 25%, #047857 50%, #059669 75%, #10b981 100%)', textColor:'#ffffff', borderColor:'#10b981', btnTextColor:'#ffffff' },
  'electric-neon': { backgroundColor:'linear-gradient(45deg, #00ffff 0%, #ff00ff 25%, #ffff00 50%, #00ff00 75%, #ff0080 100%)', textColor:'#ffffff', borderColor:'#ff00ff', btnTextColor:'#111111' },
  'business-gradient': { backgroundColor:'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #667eea 100%)', textColor:'#ffffff', borderColor:'#ffd600', btnTextColor:'#111111' }
};

// ==================== TEMPLATE HTML HANDLEBARS AVEC TRADUCTIONS ====================
const TEMPLATE = `<!DOCTYPE html>
<html lang="{{currentLang}}">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{{brand}}{{#if slogan}} - {{slogan}}{{/if}}</title>
    <meta name="description" content="{{metaDescription}}" />
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
    <link href="https://fonts.googleapis.com/css2?family={{fontGoogle}}:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
    <style>
        :root {
            --accent: {{borderColor}};
            --btnText: {{btnTextColor}};
            --bg: {{backgroundColor}};
            --text: {{textColor}};
            --font: {{fontFamily}};
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: var(--font); 
            background: var(--bg); 
            color: var(--text); 
            min-height: 100vh; 
            margin: 0; 
            padding: 0;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            padding-top: 40px;
            {{#if surfaceColor}}background: {{surfaceColor}};{{/if}}
            {{#if surfaceBorder}}border: {{surfaceBorder}};{{/if}}
            border-radius: 16px;
            {{#if useSurfaceOverlay}}backdrop-filter: blur(6px);{{else}}backdrop-filter: none !important;{{/if}}
        }
        
        /* Anti-blur force globale */
        .surface, 
        .surface-overlay, 
        .overlay-blur {
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
            background: transparent !important;
            border: 0 !important;
        }
        
        .sl-card, .sl-mobile, .sl-sheet, .price-card, .mobile-container {
            background-clip: padding-box;
        }
        
        .sl-cta * {
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
        }
        
        .banner { overflow: hidden; white-space: nowrap; margin-bottom: 20px; padding: 10px 0; min-height: 30px; }
        .banner-text { display: inline-block; padding-left: 100%; animation: scroll-left 10s linear infinite; font-weight: 600; font-size: 14px; color: var(--text); }
        @keyframes scroll-left { from { transform: translateX(0); } to { transform: translateX(-100%); } }
        
        .logo-container { text-align: center; margin: 30px 0; }
        .logo { width: 120px; height: 120px; object-fit: cover; border-radius: 50%; box-shadow: 0 4px 16px rgba(0,0,0,.1); }
        .logo.square { border-radius: 12px; }
        
        .brand-title { 
            font-size: 40px; 
            font-weight: 800; 
            text-align: center; 
            margin-bottom: 15px; 
            word-wrap: break-word; 
            line-height: 1.15;
            letter-spacing: -.02em;
        }
        .brand-title.bold { font-weight: 800 !important; }
        .brand-title.italic { font-style: italic !important; }
        
        .slogan { font-size: 18px; text-align: center; opacity: .85; margin-bottom: 30px; word-wrap: break-word; line-height: 1.4; }
        .slogan.bold { font-weight: 700 !important; }
        .slogan.italic { font-style: italic !important; }
        
        .description { font-size: 16px; line-height: 1.8; margin: 0 20px 30px; padding: 20px; word-wrap: break-word; border-radius: 12px; }
        .description.bold { font-weight: 700 !important; }
        .description.italic { font-style: italic !important; }
        
        .media-gallery { display: flex; flex-direction: column; gap: 15px; margin: 0 20px 30px; width: calc(100% - 40px); }
        .media-gallery img, .media-gallery video { 
            width: 100%; 
            max-width: 100%;
            height: auto;
            object-fit: contain;
            border-radius: 14px; 
            box-shadow: 0 2px 10px rgba(0,0,0,.12); 
        }
        
        /* Section Accès améliorée */
        .access-section { margin: 40px 20px; }
        .access-section h2 { 
            font-size: 24px; 
            font-weight: 800; 
            margin: 0 0 18px 0; 
            text-align: left;
        }
        .access-panel { 
            border: 2px solid var(--accent); 
            border-radius: 16px; 
            padding: 24px; 
            display: flex; 
            align-items: center; 
            justify-content: space-between; 
            background: color-mix(in srgb, var(--bg) 92%, #fff 8%);
            cursor: pointer; 
            transition: all .3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .access-panel:hover { 
            transform: translateY(-2px); 
            box-shadow: 0 8px 24px rgba(0,0,0,.15); 
        }
        .access-content { display: flex; align-items: center; gap: 15px; }
        .access-emoji { 
            width: 52px; 
            height: 52px; 
            background: rgba(255,255,255,.1); 
            border-radius: 12px; 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            font-size: 26px; 
        }
        .access-title { font-size: 19px; font-weight: 700; margin-bottom: 5px; }
        .access-subtitle { font-size: 14px; opacity: .8; display: flex; align-items: center; gap: 5px; }
        .access-lock { 
            width: 42px; 
            height: 42px; 
            background: rgba(255,255,255,.1); 
            border-radius: 50%; 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            color: var(--accent); 
        }
        
        /* Section Reviews améliorée SANS FOND JAUNE */
        .reviews-section { margin: 40px 20px; }
        .reviews-section h2 { 
          font-size: 24px; 
          font-weight: 800; 
          margin-bottom: 15px; 
          text-align: left; 
        }
        .review-summary {
          text-align: left;
          margin-bottom: 20px;
          padding-left: 5px;
        }
        .review-stars-large {
          font-size: 24px;
          color: #ffd700;
          margin-bottom: 5px;
        }
        .review-count {
          font-size: 16px;
          opacity: 0.8;
        }
        .review-card { 
          background: transparent;
          border-radius: 12px; 
          padding: 20px; 
          margin-bottom: 15px; 
        }
        .review-header { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
        .review-avatar { font-size: 32px; color: var(--accent); opacity: 0.8; }
        .review-author { font-weight: 600; font-size: 14px; margin-bottom: 4px; }
        .review-stars { color: #ffd700; font-size: 14px; }
        .review-comment { font-size: 14px; line-height: 1.6; opacity: 0.9; }
        
        /* Labels noirs forcés */
        .option-info-item,
        .option-info-item.highlight,
        .toggle-info-item,
        .toggle-info-item.highlight,
        .mobile-option-info-item,
        .mobile-option-info-item.highlight {
            color: #333 !important;
            font-weight: 600;
        }
        
        .legal-note {
            margin: 40px 20px 20px;
            padding: 16px;
            background: rgba(255,255,255,.03);
            border-radius: 12px;
            font-size: 13px;
            line-height: 1.6;
            opacity: .7;
            text-align: center;
        }
        
        /* Responsive */
        @media (max-width: 600px) {
            .container { padding: 15px; padding-top: 30px; }
            .brand-title { font-size: 32px; }
            .slogan { font-size: 16px; }
            .description { font-size: 14px; margin: 0 10px 20px; padding: 15px; }
            .access-panel { flex-direction: column; text-align: center; gap: 15px; }
            .access-content { flex-direction: column; }
        }
    </style>
</head>
<body>
    <div class="container">
        {{#if banner}}
        <div class="banner"><span class="banner-text">{{banner}}</span></div>
        {{/if}}

        {{#if logoUrl}}
        <div class="logo-container">
            <img src="{{logoUrl}}" alt="{{brand}}" class="logo{{#if (eq logoShape 'square')}} square{{/if}}" loading="lazy" decoding="async" />
        </div>
        {{/if}}

        <h1 class="brand-title{{#if brandBold}} bold{{/if}}{{#if brandItalic}} italic{{/if}}">{{brand}}</h1>

        {{#if slogan}}
        <p class="slogan{{#if sloganBold}} bold{{/if}}{{#if sloganItalic}} italic{{/if}}">{{slogan}}</p>
        {{/if}}

        {{#if description}}
        <div class="description{{#if descriptionBold}} bold{{/if}}{{#if descriptionItalic}} italic{{/if}}"
             {{#if descriptionBackgroundColor}}style="background: {{descriptionBackgroundColor}};"{{/if}}>
            {{{description}}}
        </div>
        {{/if}}

        {{{mediaSection}}}

        {{{priceSection}}}

        <div class="access-section">
            <h2>{{uiAccess}}</h2>
            <div class="access-panel" id="accessPanel" aria-label="{{uiAccess}} {{brand}}">
                <div class="access-content">
                    <div class="access-emoji">{{accessEmoji}}</div>
                    <div>
                        <div class="access-title">{{brand}}</div>
                        <div class="access-subtitle">
                            <i class="fab fa-telegram"></i>
                            {{uiPrivateChannel}}
                        </div>
                    </div>
                </div>
                <div class="access-lock"><i class="fas fa-lock"></i></div>
            </div>
        </div>

        {{{reviewsSection}}}
        
        <div class="legal-note">
          {{uiLegalNote1}}<br>
          {{uiLegalNote2}}
          {{#if creatorEmail}}<br>{{uiLegalNote3}} <a href="mailto:{{creatorEmail}}" style="color: var(--accent); text-decoration: none;">{{creatorEmail}}</a>.{{/if}}
        </div>
    </div>

    <script>
      // Event listener pour le panneau d'accès
      document.addEventListener('DOMContentLoaded', function() {
        var accessPanel = document.getElementById('accessPanel');
        if (accessPanel) {
          accessPanel.addEventListener('click', function() {
            window.location.href = '/checkout/{{slug}}';
          });
        }
      });
    </script>
</body>
</html>`;

// Compiler le template
let compiledTemplate = null;

// ==================== FONCTION PRINCIPALE DE GÉNÉRATION HTML ====================
async function generateHTMLFromTemplate(landing) {
  try {
    // Enregistrer les helpers
    registerHelpers();
    
    // Compiler le template si pas déjà fait
    if (!compiledTemplate) {
      compiledTemplate = Handlebars.compile(TEMPLATE);
    }
    
    const data = { ...landing };

    // Logo: invalide => vide (donc aucun rendu)
    const rawLogo = (data.logoUrl || '').trim();
    const cleaned = rawLogo ? safeUrl(rawLogo) : '';
    data.logoUrl = cleaned && cleaned !== '/' ? cleaned : '';

    // ==================== CONFIGURATION DES LANGUES ====================
    // srcLang = langue SOURCE dans laquelle le contenu a été ÉCRIT/CRÉÉ
    const srcLang = (data.sourceLanguage || data.language || 'fr').toLowerCase().substring(0, 2);
    
    // currentLang = langue d'AFFICHAGE pour les éléments UI (Access, Reviews, périodes)
    // Le contenu du créateur reste tel quel, sans traduction
    const currentLang = (data.currentLang || data.language || srcLang).toLowerCase().substring(0, 2);
    
    console.log('=== CONFIGURATION LANGUES ===');
    console.log('Langue source (contenu créé en):', srcLang);
    console.log('Langue d\'affichage (UI):', currentLang);
    console.log('Même langue?:', currentLang === srcLang);
    
    // IMPORTANT: Le contenu du créateur (slogan, description, banner, buttonText) 
    // N'EST PAS TRADUIT - le créateur écrit dans sa propre langue
    // Seuls les éléments UI (Access, Reviews, périodes d'abonnement) sont traduits
    
    // IMPORTANT: Sauvegarder le brand original
    const originalBrand = data.brand;
    
    // IMPORTANT: S'assurer que le brand reste TOUJOURS l'original
    data.brand = originalBrand;
    
    data.currentLang = currentLang;
    // désactive tout sélecteur public
    data.showLanguageSelector = false;

    // Log pour debug
    console.log('=== GÉNÉRATION HTML LANDING PAGE ===');
    console.log('Template:', data.template);
    console.log('Brand (original):', data.brand);
    console.log('Slug:', data.slug);
    console.log('Reviews:', data.reviews?.length || 0);
    console.log('Media:', (data.media || data.mediaUrls || []).length);
    console.log('Show Prices:', data.showPrices);
    console.log('Current Language:', data.currentLang);
    console.log('Logo URL:', data.logoUrl);

    // Préparer les données SEO
    prepareSEOData(data);
    
    // Normaliser les prix TOUJOURS avec la langue
    data.prices = normalizePrices(data.prices, currentLang);
    
    // Gérer le fond de la description
    const descBg = computeDescriptionBg(data);
    data.descriptionBackgroundEnabled = descBg.enabled;
    if (descBg.enabled) {
      data.descriptionBackgroundColor = descBg.color;
    }

    // Appliquer le preset template si défini
    if (data.template && TEMPLATES[data.template]) {
      const t = TEMPLATES[data.template];
      data.backgroundColor = data.backgroundColor || t.backgroundColor;
      data.textColor       = data.textColor       || t.textColor;
      data.borderColor     = data.borderColor     || t.borderColor;
      data.btnTextColor    = data.btnTextColor    || t.btnTextColor;
    }

    // Valeurs par défaut globales
    data.fontFamily  = data.fontFamily  || 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif';
    data.backgroundColor = data.backgroundColor || 'linear-gradient(135deg,#667eea,#764ba2)';
    data.textColor   = data.textColor   || '#111111';
    
    // Gestion intelligente des couleurs d'accent et de bouton
    const accent = isHexColor((data.borderColor || '').trim()) ? data.borderColor.trim() : '#ffd600';
    data.borderColor = accent;
    
    const btnTextColor = (data.btnTextColor || '').trim() || autoContrast(accent);
    const uiT = getUITranslations(currentLang);
    const buttonText = (data.buttonText || uiT.joinNow).trim();
    const buttonEmoji = (data.buttonEmoji || '').trim();
    
    // Valeur par défaut : on ne montre pas les prix
    const showPrices = typeof data.showPrices === 'boolean' ? data.showPrices : false;
    
    // Année courante
    const currentYear = new Date().getFullYear();
    
    // Ajouter les traductions UI
    const t = getUITranslations(currentLang);
    
    // Préparer les données du template
    const templateData = {
      ...data,
      borderColor: accent,
      btnTextColor: btnTextColor,
      buttonText: buttonText,
      buttonEmoji: buttonEmoji,
      accessEmoji: data.accessEmoji || '🔒',
      showPrices: showPrices,
      currentYear: currentYear,
      // Traductions UI
      uiAccess: t.access,
      uiReviews: t.reviews,
      uiPrivateChannel: t.privateChannel,
      uiLegalNote1: t.legalNote1,
      uiLegalNote2: t.legalNote2,
      uiLegalNote3: t.legalNote3,
      // Nouvelles traductions UI
      uiAnonymousUser: t.anonymousUser,
      uiOption: t.option,
      uiOptions: t.options,
      uiNoReviews: t.noReviews,
      uiLoading: t.loading,
      uiError: t.error,
      uiSelectPlan: t.selectPlan,
      uiBestValue: t.bestValue,
      uiMostPopular: t.mostPopular,
      // Sécurité au cas où
      prices: Array.isArray(data.prices) ? data.prices : []
    };

    // === Surcouche neutre quand fond = gros dégradé (évite la "tache" centrale) ===
    const HEAVY_GRADIENT_TEMPLATES = new Set([
      'sakura-bloom','lava','electric-neon','holographic-classic','sunset','aurora','business-gradient','navy-blue'
    ]);

    if (data.template && HEAVY_GRADIENT_TEMPLATES.has(data.template)) {
      templateData.surfaceColor = 'rgba(255,255,255,0.06)';
      templateData.surfaceBorder = '1px solid rgba(255,255,255,0.12)';
      templateData.surfaceBlur = true;
    } else {
      templateData.surfaceColor = '';
      templateData.surfaceBorder = '';
      templateData.surfaceBlur = false;
    }
    
    // Désactiver complètement l'overlay pour éviter le flou
    templateData.useSurfaceOverlay = false;

    // Formater la description (avec <ul>, <br>, etc.)
    templateData.description = formatDescriptionSafe(data.description || '');

    // Construire les sections avec la langue
    const mediaArray = data.media || data.mediaUrls || [];
    templateData.mediaSection = buildMediaSection(mediaArray);
    templateData.reviewsSection = buildReviewsSection(data.reviews, currentLang);
    
    // Construire la section prix UNIQUEMENT si showPrices est true
    templateData.priceSection = showPrices ? buildPriceSection(templateData, currentLang) : '';

    // Compiler le HTML final
    const html = compiledTemplate(templateData);
    
    return html;
    
  } catch (error) {
    console.error('❌ Erreur génération template Handlebars:', error);
    throw error;
  }
}

// ==================== EXPORT ====================
module.exports = {
  generateHTMLFromTemplate,
  generateHTML: generateHTMLFromTemplate,  // ALIAS pour server.js
  translateLandingContent,  // Export de la fonction de traduction DeepL
  getUITranslations,
  UI_TRANSLATIONS
};