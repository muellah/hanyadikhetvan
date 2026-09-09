# hanyadikhetvan.hu

Egyoldalas weboldal, ami megmondja, hogy az év hányadik hete van.

## Hogyan működik

Régen ez egy PHP oldal volt, amit a webszerver minden egyes látogatásnál lefuttatott.
Most a PHP naponta **egyszer** fut le a GitHubon, és az eredményét sima HTML-ként
tesszük ki. Így nem kell PHP-t futtató (és fizetős) tárhely.

```
src/index.php   ──►  build.sh  ──►  dist/index.html  ──►  Netlify  ──►  hanyadikhetvan.hu
   a forrás          generálás        a kész oldal        tárhely
```

- **`src/index.php`** – itt kell szerkeszteni bármit. Ez a forrás.
- **`dist/`** – generált mappa, **ide soha ne írj kézzel**, felülíródik.
- **`.github/workflows/build.yml`** – naponta 00:30-kor (magyar idő) újragenerálja az oldalt.
- **`netlify.toml`** – a Netlify beállításai.

## Helyi kipróbálás

```bash
./build.sh && open dist/index.html
```

## Kézi frissítés

GitHub → **Actions** fül → *Oldal generálása* → **Run workflow** gomb.

## Miért van JavaScript is az oldalon

Az oldal HTML-je naponta egyszer készül. Ha egy generálás valamiért kimaradna,
a beépített JavaScript a látogató böngészőjében kiszámolja a helyes hetet, tehát
**a látogató akkor is jó számot lát, ha a napi frissítés elmarad**. A HTML-be
sütött érték a keresőrobotoknak kell, akik nem futtatnak JavaScriptet.

## Amit tudni érdemes

- A hét **magyar idő** szerint vált (vasárnap éjfélkor), nem UTC szerint.
- A magyar hónap- és napnevek fixen be vannak írva a `src/index.php`-ba.
  Ez szándékos: a régi verzió a szerver `hu_HU` beállítására támaszkodott, és
  olyan gépen, ahol az hiányzott, a dátum **némán eltűnt** az oldalról.
- A `build.sh` leáll hibával, ha a generált oldalról hiányzik a hétszám vagy a
  dátum, tehát törött oldal nem tud kimenni élesbe.
