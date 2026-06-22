import { useState } from 'react';
import { ChevronDown, HelpCircle, Shield, Zap, Globe, Target, TrendingUp, Users, Award, Bot } from 'lucide-react';
import Layout from '../components/Layout';

const FAQ_ITEMS = [
  {
    question: 'Nasil Yatirim Yapilir?',
    icon: Zap,
    answer:
      'Hesabiniz sayfasina giderek "Para Yatir" bolumunden yatirim yapabilirsiniz. Yatirim yapmak istediginiz tutari girin, ardindan "Yatirim Yap" butonuna tiklayin. Yatiriminiz aninda hesabiniza yansiyacak ve VIP seviyeniz otomatik olarak guncellenecektir. Her 100$ yatirim size 1 cark cevirme hakki kazandirir. VIP seviyeniz arttikca gunluk tiklama basina kazanciniz da artar. Yatirimlariniz AI algoritmalarimiz tarafindan yonetilerek en yuksek getiriyi elde etmeniz saglanir.',
  },
  {
    question: 'Nasil Cekim Yapilir?',
    icon: Target,
    answer:
      'Hesabiniz sayfasina giderek "Cekim Yap" bolumunden bakiyenizi cekebilirsiniz. Cekim yapabilmek icin en az 5 gun boyunca gunluk tiklamaniz gerekmektedir. Ayrica her cekimden once 72 saat bekleme suresi vardir. Ilk cekiminiz 30 gun icin ucretsizdir, sonraki cekimlerde ise %5 islem ucreti kesilir. Minimum cekim tutari 10$\'dir. Cekim talebiniz admin onayindan gecer ve en kisa surede hesabiniza aktarilir.',
  },
  {
    question: 'Referans Kodu Nasil Isler?',
    icon: Users,
    answer:
      'Kendi referans kodunuzu arkadaslarinizla paylasarak ek kazanclar elde edebilirsiniz. Davet ettiginiz her kullanicinin yaptigi yatirimdan %3, onlarin davet ettiklerinden %2 ve ucuncu kademeden %1 komisyon kazanirsiniz. Ayrica davet ettiginiz bir uye 100$ veya uzeri yatirim yaparsa 1 ek cark cevirme hakki elde edersiniz. Referans gelirleriniz otomatik olarak bakiyenize eklenir. Ne kadar cok kisi davet ederseniz, o kadar cok pasif gelir elde edersiniz.',
  },
];

const ABOUT_SECTIONS = [
  {
    title: 'Misyonumuz',
    icon: Target,
    text: 'CoreVest olarak misyonumuz, herkesin erisebilecegi, seffaf ve guvenilir bir yatirim ortami sunmaktir. Finansal ozgurlugu herkes icin mumkun kilmak icin calisiyoruz.',
  },
  {
    title: 'Vizyonumuz',
    icon: Globe,
    text: 'AI teknolojisini kullanarak butun yatirimcilara profesyonel duzeyde kripto ticareti yapma imkani saglamak. Dunyanin en guvenilir AI destekli yatirim platformu olmak.',
  },
  {
    title: 'Guvenlik',
    icon: Shield,
    text: 'En son guvenlik teknolojileri ile kullanici verilerinizi ve yatirimlarinizi koruyoruz. SSL sifreleme, iki faktorlu dogrulama ve anlik dolandiricilik korumasi aktif.',
  },
  {
    title: 'AI Teknolojisi',
    icon: Bot,
    text: 'Gelismis yapay zeka algoritmalarimiz 7/24 piyasalari analiz ederek en karli ticaret stratejilerini otomatik olarak uygular. Makine ogrenmesi sayesinde her gecen gun daha da iyilesiyoruz.',
  },
  {
    title: 'Kazanc Modeli',
    icon: TrendingUp,
    text: 'Gunluk tiklamalar, VIP seviyeleri, referans sistemi ve sans carki ile birden fazla kazancl kaynagi sunuyoruz. Yatiriminiz ne kadar yuksek olursa, kazanc potansiyeliniz de o kadar artar.',
  },
  {
    title: 'Topluluk',
    icon: Award,
    text: 'Dunya capinda 100.000+ aktif kullanicimiz ile buyuyen bir toplulugun parcasi olun. Birlikte daha guclu, birlikte daha basariliyiz.',
  },
];

export default function FAQ() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setOpenFaq(prev => (prev === index ? null : index));
  };

  return (
    <Layout>
      <div className="grid gap-4">
        {/* Page Header */}
        <div
          className="animate-fade-in"
          style={{
            border: '1px solid rgba(248,251,255,0.11)',
            borderRadius: '18px',
            padding: '22px',
            background: 'radial-gradient(circle at 76% 22%, rgba(255,215,0,0.12), transparent 30%), linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))',
            boxShadow: '0 22px 60px rgba(0,0,0,0.32)',
          }}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="grid place-items-center rounded-xl" style={{ width: '42px', height: '42px', color: '#FFD700', background: 'rgba(255,215,0,0.12)' }}>
              <HelpCircle size={22} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Sikca Sorulan Sorular</h1>
              <p className="text-xs" style={{ color: '#8fa5b8' }}>Merak ettiklerinizin yanitlari burada</p>
            </div>
          </div>
        </div>

        {/* FAQ Accordion */}
        <div className="grid gap-2">
          {FAQ_ITEMS.map((item, index) => {
            const isOpen = openFaq === index;
            const Icon = item.icon;
            return (
              <div
                key={index}
                className="overflow-hidden animate-fade-in transition-all"
                style={{
                  borderRadius: '16px',
                  border: isOpen ? '1px solid rgba(255,215,0,0.22)' : '1px solid rgba(248,251,255,0.07)',
                  background: isOpen ? 'rgba(255,215,0,0.04)' : 'rgba(255,255,255,0.03)',
                  boxShadow: isOpen ? '0 8px 32px rgba(255,215,0,0.08)' : 'none',
                }}
              >
                <button
                  onClick={() => toggleFaq(index)}
                  className="w-full flex items-center justify-between px-4 py-4 text-left transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="grid place-items-center rounded-lg shrink-0"
                      style={{
                        width: '34px',
                        height: '34px',
                        color: isOpen ? '#FFD700' : '#5a6a7a',
                        background: isOpen ? 'rgba(255,215,0,0.12)' : 'rgba(255,255,255,0.05)',
                        transition: 'all 0.3s ease',
                      }}
                    >
                      <Icon size={18} />
                    </div>
                    <span className="text-sm font-bold text-white">{item.question}</span>
                  </div>
                  <ChevronDown
                    size={18}
                    className="shrink-0 transition-transform duration-300"
                    style={{
                      color: '#FFD700',
                      transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    }}
                  />
                </button>
                <div
                  className="overflow-hidden transition-all duration-400"
                  style={{
                    maxHeight: isOpen ? '400px' : '0px',
                    opacity: isOpen ? 1 : 0,
                  }}
                >
                  <p className="px-4 pb-4 text-xs leading-relaxed" style={{ color: '#a9bccf', paddingLeft: '62px' }}>
                    {item.answer}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* CoreVest About Section */}
        <div
          className="animate-fade-in"
          style={{
            border: '1px solid rgba(255,215,0,0.15)',
            borderRadius: '18px',
            padding: '24px',
            background: 'radial-gradient(circle at 30% 20%, rgba(255,215,0,0.10), transparent 50%), radial-gradient(circle at 80% 80%, rgba(255,165,0,0.06), transparent 40%), linear-gradient(135deg, rgba(5,9,20,0.98), rgba(15,10,5,0.98))',
            boxShadow: '0 22px 60px rgba(0,0,0,0.32)',
          }}
        >
          {/* Header */}
          <div className="text-center mb-6">
            <div className="flex items-center justify-center gap-2 mb-3">
              <img src="/logo-icon.png" alt="Corevest" className="w-10 h-10 rounded-lg" />
              <span className="text-xl font-extrabold tracking-wide">
                <span className="text-white">CORE</span>
                <span style={{ color: '#FFD700' }}>VEST</span>
              </span>
            </div>
            <p className="text-xs font-semibold mb-2" style={{ color: '#FFD700' }}>
              2023\'ten Beri Gelecegin Finans Dunyasinda Yerinizi Alin
            </p>
            <p className="text-xs leading-relaxed max-w-lg mx-auto" style={{ color: '#a9bccf' }}>
              CoreVest, 2023 yilindan bu yana faaliyet gosteren yapay zeka destekli kripto yatirim platformudur. 
              En son teknolojileri kullanarak kripto para piyasalarini analiz eder ve en karli ticaret stratejilerini 
              otomatik olarak uygulariz.
            </p>
          </div>

          {/* Info Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ABOUT_SECTIONS.map((section, i) => {
              const SectionIcon = section.icon;
              return (
                <div
                  key={i}
                  className="rounded-xl p-4"
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(248,251,255,0.06)',
                  }}
                >
                  <div className="flex items-center gap-2.5 mb-2">
                    <div
                      className="grid place-items-center rounded-lg shrink-0"
                      style={{
                        width: '32px',
                        height: '32px',
                        color: '#FFD700',
                        background: 'rgba(255,215,0,0.10)',
                      }}
                    >
                      <SectionIcon size={16} />
                    </div>
                    <h3 className="text-sm font-bold text-white">{section.title}</h3>
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: '#a9bccf' }}>
                    {section.text}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Stats Row */}
          <div
            className="grid grid-cols-3 gap-3 mt-4 rounded-xl p-4"
            style={{
              background: 'rgba(255,215,0,0.04)',
              border: '1px solid rgba(255,215,0,0.10)',
            }}
          >
            {[
              { label: 'Aktif Kullanici', value: '10.000+' },
              { label: 'Yillik Kazanc', value: '$5M+' },
              { label: 'Ulke', value: '23+' },
            ].map((stat, i) => (
              <div key={i} className="text-center">
                <p className="text-lg font-extrabold" style={{ color: '#FFD700' }}>{stat.value}</p>
                <p className="text-[10px] font-medium" style={{ color: '#8fa5b8' }}>{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Bottom CTA */}
          <div className="text-center mt-5">
            <p className="text-xs font-semibold mb-1" style={{ color: '#FFD700' }}>
              CoreVest ile Gelecege Yatirim Yapin
            </p>
            <p className="text-xs" style={{ color: '#8fa5b8' }}>
              AI destekli platformumuzla kripto dunyasinda one cikin.
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
