import { useState } from 'react';
import { ChevronDown, HelpCircle, Shield, Zap, Globe, Target, TrendingUp, Users, Award, Bot } from 'lucide-react';
import Layout from '../components/Layout';
import { trpc } from '@/providers/trpc';
import { FAQ_CONTENT_KEYS, mergeSiteContent } from '@contracts/site-content';

const ABOUT_SECTIONS = [
  {
    title: 'Misyonumuz',
    icon: Target,
    text: 'CoreVest olarak misyonumuz, herkesin erişebileceği, şeffaf ve güvenilir bir yatırım ortamı sunmaktır. Finansal özgürlüğü herkes için mümkün kılmak için çalışıyoruz.',
  },
  {
    title: 'Vizyonumuz',
    icon: Globe,
    text: 'AI teknolojisini kullanarak bütün yatırımcılara profesyonel düzeyde kripto ticareti yapma imkânı sağlamak. Dünyanın en güvenilir AI destekli yatırım platformu olmak.',
  },
  {
    title: 'Güvenlik',
    icon: Shield,
    text: 'En son güvenlik teknolojileri ile kullanıcı verilerinizi ve yatırımlarınızı koruyoruz. SSL şifreleme, iki faktörlü doğrulama ve anlık dolandırıcılık koruması aktif.',
  },
  {
    title: 'AI Teknolojisi',
    icon: Bot,
    text: 'Gelişmiş yapay zeka algoritmalarımız 7/24 piyasaları analiz ederek en kârlı ticaret stratejilerini otomatik olarak uygular. Makine öğrenmesi sayesinde her geçen gün daha da iyileşiyoruz.',
  },
  {
    title: 'Kazanç Modeli',
    icon: TrendingUp,
    text: 'Günlük tıklamalar, VIP seviyeleri, referans sistemi ve şans çarkı ile birden fazla kazanç kaynağı sunuyoruz. Yatırımınız ne kadar yüksek olursa, kazanç potansiyeliniz de o kadar artar.',
  },
  {
    title: 'Topluluk',
    icon: Award,
    text: 'Dünya çapında 100.000+ aktif kullanıcımız ile büyüyen bir topluluğun parçası olun. Birlikte daha güçlü, birlikte daha başarılıyız.',
  },
];

export default function FAQ() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const { data: siteContentData } = trpc.siteContent.public.useQuery(undefined, {
    staleTime: 1000 * 30,
    retry: false,
  });
  const siteContent = mergeSiteContent(siteContentData);

  const faqItems = [
    {
      question: siteContent[FAQ_CONTENT_KEYS.investmentQuestion],
      icon: Zap,
      answer: siteContent[FAQ_CONTENT_KEYS.investmentAnswer],
    },
    {
      question: siteContent[FAQ_CONTENT_KEYS.withdrawalQuestion],
      icon: Target,
      answer: siteContent[FAQ_CONTENT_KEYS.withdrawalAnswer],
    },
    {
      question: siteContent[FAQ_CONTENT_KEYS.referralQuestion],
      icon: Users,
      answer: siteContent[FAQ_CONTENT_KEYS.referralAnswer],
    },
  ];

  const toggleFaq = (index: number) => {
    setOpenFaq(prev => (prev === index ? null : index));
  };

  return (
    <Layout>
      <div className="grid gap-4">
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
              <h1 className="text-xl font-bold text-white">Sıkça Sorulan Sorular</h1>
              <p className="text-xs" style={{ color: '#8fa5b8' }}>Merak ettiklerinizin yanıtları burada</p>
            </div>
          </div>
        </div>

        <div className="grid gap-2">
          {faqItems.map((item, index) => {
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
          <div className="text-center mb-6">
            <div className="flex items-center justify-center gap-2 mb-3">
              <img src="/logo-icon.png" alt="Corevest" className="w-10 h-10 rounded-lg" />
              <span className="text-xl font-extrabold tracking-wide">
                <span className="text-white">CORE</span>
                <span style={{ color: '#FFD700' }}>VEST</span>
              </span>
            </div>
            <p className="text-xs font-semibold mb-2" style={{ color: '#FFD700' }}>
              2023'ten Beri Geleceğin Finans Dünyasında Yerinizi Alın
            </p>
            <p className="text-xs leading-relaxed max-w-lg mx-auto" style={{ color: '#a9bccf' }}>
              CoreVest, 2023 yılından bu yana faaliyet gösteren yapay zeka destekli kripto yatırım platformudur.
              En son teknolojileri kullanarak kripto para piyasalarını analiz eder ve en kârlı ticaret stratejilerini
              otomatik olarak uygularız.
            </p>
          </div>

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

          <div
            className="grid grid-cols-3 gap-3 mt-4 rounded-xl p-4"
            style={{
              background: 'rgba(255,215,0,0.04)',
              border: '1px solid rgba(255,215,0,0.10)',
            }}
          >
            {[
              { label: 'Aktif Kullanıcı', value: '10.000+' },
              { label: 'Yıllık Kazanç', value: '$5M+' },
              { label: 'Ülke', value: '23+' },
            ].map((stat, i) => (
              <div key={i} className="text-center">
                <p className="text-lg font-extrabold" style={{ color: '#FFD700' }}>{stat.value}</p>
                <p className="text-[10px] font-medium" style={{ color: '#8fa5b8' }}>{stat.label}</p>
              </div>
            ))}
          </div>

          <div className="text-center mt-5">
            <p className="text-xs font-semibold mb-1" style={{ color: '#FFD700' }}>
              CoreVest ile Geleceğe Yatırım Yapın
            </p>
            <p className="text-xs" style={{ color: '#8fa5b8' }}>
              AI destekli platformumuzla kripto dünyasında öne çıkın.
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
