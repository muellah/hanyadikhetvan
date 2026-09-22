# DNS-átállás: hanyadikhetvan.hu a Netlify-ra

Állapot 2026-09-22. Az éles oldal még a DotRollon fut, ez a leírás az átállás lépéseit rögzíti.

## FONTOS: ne a névszervereket állítsd át

A levelezésed a `mx.dotroll.com` MX rekordon megy. Ha a névszervereket a Netlify-ra
viszed, a DotRoll zónája (és benne az MX) megszűnik, és **a leveleid leállnak**, amíg
kézzel újra létre nem hozod őket a Netlify DNS-ben.

Marad tehát a DNS a DotRollnál, és csak **két rekord** változik.

## FONTOS 2: az átállás után is kell a DotRoll-fiók

Ez a terv **csak a webkiszolgálást** viszi át a Netlify-ra. A domain DNS-zónája és a
levelezés (`mx.dotroll.com`) a DotRollnál marad. Tehát amikor lemondasz valamit, a
**webtárhely-szolgáltatást** mondod le, nem a fiókot és nem a domaint.

Mielőtt bármit lemondanál, kérdezd meg a DotRollt: **adnak-e DNS-kezelést és levelezést
webtárhely-csomag nélkül?** Ha nem, akkor vagy marad egy minimális csomag, vagy a DNS-t és
a levelezést is át kell vinni máshová, és az már egy külön, nagyobb lépés (az MX és a
Google-verifikációs TXT rekordot is újra létre kellene hozni).

## Sorrend (ez a sorrend számít)

### 1. A domain hozzáadása a Netlify oldalán (ELŐSZÖR)

A Netlify csak azokat a hosztneveket szolgálja ki, amiket ismer. Amíg ez nincs meg,
a DNS-átállítás után a site nem jönne fel, és tanúsítványt sem kapna.

Netlify → [hanyadikhetvan projekt](https://app.netlify.com/projects/hanyadikhetvan)
→ Domain management → Add a domain:

- `hanyadikhetvan.hu` (ez legyen az elsődleges)
- `www.hanyadikhetvan.hu` (aliasként; a Netlify általában magától felajánlja)

A Netlify ekkor "Awaiting External DNS" állapotot mutat. Ez helyes, a DNS még a
DotRollra mutat.

### 2. A két rekord a DotRoll DNS-ében

| Típus | Név | Érték |
|---|---|---|
| A (vagy ALIAS/ANAME, ha a DotRoll tudja) | `@` (a domain maga) | `75.2.60.5` (ALIAS esetén: `apex-loadbalancer.netlify.com`) |
| CNAME | `www` | `hanyadikhetvan.netlify.app` |

Ha a DotRoll kínál ALIAS vagy ANAME típust, az jobb, mint a fix IP: a Netlify így
szabadon cserélheti a load balancer címét.

**Amihez ne nyúlj:** MX (`5 mx.dotroll.com`) és a Google verifikációs TXT rekord.

### 3. Várakozás

A terjedés akár egy nap is lehet (Netlify dokumentáció). A HTTPS-tanúsítvány csak
azután készül el, hogy a DNS már a Netlify-ra mutat, tehát rövid ideig
tanúsítványhiba látszódhat. Ez normális, nem kell közbeavatkozni.

### 4. Ellenőrzés az átállás után

```bash
dig +short hanyadikhetvan.hu A            # 75.2.60.5 kell legyen
dig +short hanyadikhetvan.hu MX           # tovabbra is 5 mx.dotroll.com
curl -sI https://hanyadikhetvan.hu/ | head -3
curl -s https://hanyadikhetvan.hu/ | grep -o 'id="hetszam">[0-9]*\.'
curl -sI http://hanyadikhetvan.hu/ | head -3    # 301 kell https-re
```

Az utolsó sor azért kell, mert a régi DotRoll-szerver átirányította a HTTP-t HTTPS-re, a
Netlify oldalán viszont a "force HTTPS" jelenleg nincs bekapcsolva (tanúsítvány híján még
nem is lehet). Ha a tanúsítvány elkészülte után ez a parancs nem 301-et ad, kapcsold be:
Netlify → Domain management → HTTPS → Force HTTPS.

## Visszaút

Ha bármi félremegy, a DotRoll DNS-ben állítsd vissza pontosan ezt a két értéket:

| Típus | Név | Érték |
|---|---|---|
| A | `@` | `134.209.91.8` |
| CNAME | `www` | `hanyadikhetvan.hu` |

A régi PHP-oldal a DotRoll szerverén érintetlenül megvan, tehát a visszaállás azonnal él.
