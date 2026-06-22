# Corevest Demo

React, TypeScript, Vite ve Tailwind CSS ile hazırlanmış yatırım paneli demosu.

> [!WARNING]
> Bu sürüm bir ön yüz demosudur. Kullanıcılar, bakiye, talepler ve admin işlemleri
> tarayıcının `localStorage`/`sessionStorage` alanında tutulur. Gerçek para, gerçek
> üyelik veya hassas veriyle kullanmayın. Gerçek ürün için sunucu tarafı kimlik
> doğrulama, veritabanı, yetkilendirme ve ödeme doğrulaması gerekir.

## Yerelde çalıştırma

Gerekenler: Node.js 22 ve pnpm 11.

```bash
pnpm install
pnpm run dev
```

Tarayıcıda `http://localhost:3000` adresini açın.

Üretim kontrolü:

```bash
pnpm run lint
pnpm run build
pnpm run start
```

## GitHub'a yükleme

Terminali bu README'nin bulunduğu `app` klasöründe açın:

```bash
git init
git add .
git commit -m "Corevest Railway deploy"
git branch -M main
git remote add origin https://github.com/KULLANICI_ADINIZ/REPO_ADINIZ.git
git push -u origin main
```

GitHub'da önce boş bir repo oluşturun. `KULLANICI_ADINIZ` ve `REPO_ADINIZ`
alanlarını kendi bilgilerinizle değiştirin. GitHub Actions her gönderimde lint ve
üretim derlemesini otomatik kontrol eder.

## Railway'de yayınlama

1. [Railway](https://railway.com/) hesabınıza GitHub ile giriş yapın.
2. **New Project → Deploy from GitHub repo** seçin.
3. Corevest reposunu seçin.
4. Repo kökünde doğrudan bu dosyalar varsa başka ayar yapmayın.
5. GitHub'a `COREVEST` üst klasörünü yüklediyseniz Railway ayarlarında
   **Root Directory** değerini `/app` yapın.
6. Railway `railway.json` dosyasını okuyup `pnpm run build` ve `pnpm run start`
   komutlarını otomatik kullanır.
7. Deploy tamamlanınca **Settings → Networking → Generate Domain** seçin.

Ortam değişkeni gerekmiyor. Railway'in verdiği `PORT` değeri uygulama tarafından
otomatik okunur.

## Komutlar

- `pnpm run dev`: geliştirme sunucusu
- `pnpm run lint`: kod kalite kontrolü
- `pnpm run build`: üretim derlemesi
- `pnpm run start`: `dist` klasörünü Railway uyumlu sunucuyla yayınlar

## Önemli güvenlik notu

Demo admin bilgileri istemci paketinde bulunabildiğinden güvenli bir sır değildir.
Gerçek yayına geçmeden önce admin girişi ve tüm finansal işlemler bir backend API'ye
taşınmalıdır. Bu demo yalnızca arayüz sunumu ve iş akışı testi içindir.
