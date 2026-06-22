# Corevest V9

React, TypeScript, Hono, tRPC, Drizzle ORM ve MySQL ile hazırlanmış tam yığın
Corevest uygulaması.

## Yerel geliştirme

Node.js 22 ve pnpm 11 gerekir.

```bash
pnpm install
copy .env.example .env
pnpm db:push
pnpm dev
```

`.env` içindeki veritabanı ve parola değerlerini çalıştırmadan önce değiştirin.

## Kontroller

```bash
pnpm check
pnpm lint
pnpm build
```

## Railway kurulumu

1. Railway projesinde **New → Database → Add MySQL** seçin.
2. Corevest servisinde **Variables** bölümünü açın.
3. Aşağıdaki değişkenleri ekleyin:

```text
DATABASE_URL=${{MySQL.MYSQL_URL}}
APP_SECRET=uzun-rastgele-bir-deger
ADMIN_EMAIL=yonetici-epostaniz
ADMIN_PASSWORD=guclu-yonetici-sifreniz
```

MySQL servisinizin adı farklıysa `MySQL` bölümünü o servis adıyla değiştirin.
Deploy sırasında şema otomatik oluşturulur. İlk başarılı başlangıçta admin hesabı
da otomatik hazırlanır.

## Yayın akışı

`main` dalına gönderilen her commit GitHub Actions tarafından kontrol edilir ve
Railway tarafından otomatik yayınlanır.

```bash
git add .
git commit -m "Site güncellendi"
git push
```

## Güvenlik

- `.env` dosyası Git'e gönderilmez.
- Admin parolası kaynak kodda tutulmaz.
- Parolalar `scrypt` ile tuzlanarak özetlenir.
- Admin API işlemleri sunucu tarafında rol kontrolünden geçer.
