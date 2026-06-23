export const FAQ_CONTENT_KEYS = {
  investmentQuestion: "faq.investment.question",
  investmentAnswer: "faq.investment.answer",
  withdrawalQuestion: "faq.withdrawal.question",
  withdrawalAnswer: "faq.withdrawal.answer",
  referralQuestion: "faq.referral.question",
  referralAnswer: "faq.referral.answer",
} as const;

export const ANNOUNCEMENT_CONTENT_KEYS = {
  enabled: "announcement.enabled",
  version: "announcement.version",
  imageUrl: "announcement.imageUrl",
  title: "announcement.title",
  subtitle: "announcement.subtitle",
  body: "announcement.body",
  rules: "announcement.rules",
  note: "announcement.note",
  footer: "announcement.footer",
  button: "announcement.button",
} as const;

export const DEFAULT_SITE_CONTENT: Record<string, string> = {
  [FAQ_CONTENT_KEYS.investmentQuestion]: "Nasıl Yatırım Yapılır?",
  [FAQ_CONTENT_KEYS.investmentAnswer]:
    'Hesabınız sayfasına giderek "Para Yatır" bölümünden yatırım yapabilirsiniz. Yatırım yapmak istediğiniz tutarı girin, ardından "Yatırımı Onayla" butonuna tıklayın. Yatırımınız admin onayından sonra hesabınıza yansır ve VIP seviyeniz otomatik olarak güncellenir. VIP seviyeniz arttıkça günlük tıklama başına kazancınız da artar. Yatırımlarınız AI algoritmalarımız tarafından yönetilerek en yüksek getiriyi elde etmeniz sağlanır.',
  [FAQ_CONTENT_KEYS.withdrawalQuestion]: "Nasıl Çekim Yapılır?",
  [FAQ_CONTENT_KEYS.withdrawalAnswer]:
    'Hesabınız sayfasına giderek "Çekim Yap" bölümünden bakiyenizi çekebilirsiniz. Çekim yapabilmek için en az 5 gün boyunca günlük tıklamanız gerekmektedir. Ayrıca her çekimden önce 72 saat bekleme süresi vardır. İlk çekiminiz 30 gün için ücretsizdir, sonraki çekimlerde ise %5 işlem ücreti kesilir. Minimum çekim tutarı 50$\'dır. Çekim talebiniz admin onayından geçer ve en kısa sürede hesabınıza aktarılır.',
  [FAQ_CONTENT_KEYS.referralQuestion]: "Referans Kodu Nasıl İşler?",
  [FAQ_CONTENT_KEYS.referralAnswer]:
    "Kendi referans kodunuzu arkadaşlarınızla paylaşarak ek kazançlar elde edebilirsiniz. Davet ettiğiniz her kullanıcının tıklamalarından %10, onların davet ettiklerinden %6 ve üçüncü kademeden %3 komisyon kazanırsınız. Referans gelirleriniz otomatik olarak bakiyenize eklenir. Ne kadar çok kişi davet ederseniz, o kadar çok pasif gelir elde edersiniz.",
  [ANNOUNCEMENT_CONTENT_KEYS.enabled]: "true",
  [ANNOUNCEMENT_CONTENT_KEYS.version]: "v1",
  [ANNOUNCEMENT_CONTENT_KEYS.imageUrl]: "",
  [ANNOUNCEMENT_CONTENT_KEYS.title]: "🎉 🎡 ÇARK AKTİF! 🎡 🎉",
  [ANNOUNCEMENT_CONTENT_KEYS.subtitle]: "1.000$'a kadar hediye bonus kazanma fırsatı sizi bekliyor!",
  [ANNOUNCEMENT_CONTENT_KEYS.body]:
    "Şans çarkını çevirin ve birbirinden değerli ödülleri kazanma şansını yakalayın. 🚀",
  [ANNOUNCEMENT_CONTENT_KEYS.rules]:
    "Her 100$ yatırım için 1 SPIN hakkı kazanırsınız.\nDavet ettiğiniz bir üyenin 100$ veya üzeri yatırım yapması durumunda 1 ek SPIN hakkı elde edersiniz.\nNe kadar çok yatırım ve davet, o kadar çok çevirme hakkı!",
  [ANNOUNCEMENT_CONTENT_KEYS.note]: "🍀 Şansınızı deneyin, sürpriz bonusları kaçırmayın!",
  [ANNOUNCEMENT_CONTENT_KEYS.footer]: "🎡 Çark sizi bekliyor! 🚀 CoreVest ile kazanmaya devam edin.",
  [ANNOUNCEMENT_CONTENT_KEYS.button]: "Tamam",
};

export function mergeSiteContent(values: Record<string, string> | undefined | null) {
  return {
    ...DEFAULT_SITE_CONTENT,
    ...(values ?? {}),
  };
}
