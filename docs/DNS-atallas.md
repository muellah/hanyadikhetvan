# hanyadikhetvan.hu: hosting és DNS

Állapot 2026-09-24: az oldalt a **GitHub Pages** szolgálja ki. A DNS és a levelezés a
DotRollnál van.

## Jelenlegi DNS (DotRoll)

| Típus | Név | Érték | Megjegyzés |
|---|---|---|---|
| A | `@` | `185.199.108.153` | GitHub Pages |
| CNAME | `www` | `muellah.github.io.` | a Pages magától átirányít az apexre |
| Mail Forward | `@` | Alapértelmezett levelezőszerver | **ez adja az MX-et (`5 mx.dotroll.com`), ne töröld** |
| TXT | `@` | `google-site-verification=...` | Search Console, ne töröld |
| NS | `@` | `ns1/ns2.dotroll.com` | maradnak |

**Hiányzik még (ajánlott, nem kötelező):** a GitHub négy A rekordot javasol a redundancia
miatt. A másik hármat kézzel kell felvenni a DotRoll DNS-szerkesztőben ("Hozzáad", típus A,
név `hanyadikhetvan.hu`, TTL 10 perc):

- `185.199.109.153`
- `185.199.110.153`
- `185.199.111.153`

Egy rekorddal is működik; a `www` már most mind a négy címet megkapja a
`muellah.github.io`-n keresztül.

## A DotRoll-fiókot ne mondd fel

A DNS-zóna és a levelezés ott van. Ha valaha le akarod mondani, előbb kérdezd meg, adnak-e
DNS-kezelést és levelezést tárhelycsomag nélkül, vagy vidd át mindkettőt máshová (az MX-et
és a TXT-t is újra létre kell hozni).

## Hogyan frissül az oldal

- `.github/workflows/build.yml`: naponta 23:30 UTC-kor legenerálja a `dist/` mappát és
  commitolja. Ez tartja aktívnak a repót (a GitHub 60 nap inaktivitás után letiltja az
  ütemezett workflow-kat).
- `.github/workflows/pages.yml`: naponta 23:35 UTC-kor újragenerál és kiteszi a GitHub
  Pages-re. Kézzel is indítható az Actions fülön.
- A GitHub Actions és a Pages publikus repón ingyenes.

## Miért nem a Netlify

A Netlify ingyenes csomagja **deployonként 15 kreditet** számol, a havi keret 1000. A napi
build így havi ~450 kreditet vitt volna, a keret 45 százalékát, egy egyoldalas oldalért.
A forgalom ehhez képest elhanyagolható (60 KB/látogatás, ~37 000 látogatás/hó az Ahrefs
szerint, kb. 2 GB). A Netlify-projekt megmaradt tartaléknak, az automatikus build ki van
kapcsolva (`stop_builds: true`), így nem fogyaszt.

## Visszaút a Netlify-ra

1. Netlify: `stop_builds` vissza `false`-ra (Project configuration -> Build & deploy), és
   indíts egy deployt.
2. DotRoll: az A rekord(ok) helyett egy A `@` -> `75.2.60.5`, a `www` CNAME ->
   `hanyadikhetvan.netlify.app.`
3. **GitHub repo Settings -> Pages: töröld a custom domaint.** A GitHub figyelmeztet, hogy
   letiltott Pages-oldal élő DNS-rekordokkal domain-átvételi kockázat.

A DNS-rekordok TTL-je 10 perc, tehát a váltás gyorsan él.

## Ellenőrzés

**Automatikus, 3 hétfőn át** (2026-09-28, 10-05, 10-12, mindig 00:01 Budapest):
`.github/workflows/healthcheck.yml` futtatja a `scripts/healthcheck.mjs`-t (22 ellenőrzés: DNS,
MX, tanúsítvány, átirányítások, a beégetett hétszám, a látogató által látott hétszám a JS
lefuttatásával, eszközök, a napi workflow-k frissessége). Hiba esetén a workflow piros lesz
(a GitHub emailt küld) és issue nyílik a teljes jelentéssel. Az utolsó futás után kikapcsolja
magát. Kézzel bármikor indítható: Actions -> "Heti élesüzem-ellenőrzés" -> Run workflow.

Helyben: `node scripts/healthcheck.mjs`

Kézi parancsok:

```bash
dig +short hanyadikhetvan.hu A        # 185.199.10x.153
dig +short hanyadikhetvan.hu MX       # 5 mx.dotroll.com.
curl -sI https://hanyadikhetvan.hu/ | grep -i server    # GitHub.com
curl -s https://hanyadikhetvan.hu/ | grep -o 'id="hetszam">[0-9]*\.'
```
