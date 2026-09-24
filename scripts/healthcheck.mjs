// hanyadikhetvan.hu élesüzem-ellenőrzés. Függőség nélkül fut: node 18+.
// Kilépési kód: 0 = minden rendben, 1 = legalább egy hiba.
// Teszteléshez: HC_NOW=2026-09-27T22:01:00Z a "most" felülírására,
//               HC_HTML=fajl.html a letöltött oldal helyett helyi fájl.
import tls from 'node:tls';
import vm from 'node:vm';
import fs from 'node:fs';
import dns from 'node:dns/promises';

const HOST = 'hanyadikhetvan.hu';
const REPO = 'muellah/hanyadikhetvan';
const GH_IPS = ['185.199.108.153', '185.199.109.153', '185.199.110.153', '185.199.111.153'];
const NOW = process.env.HC_NOW ? new Date(process.env.HC_NOW) : new Date();
const results = [];
const check = (name, ok, detail) => results.push({ name, ok: !!ok, detail });

// ---- dátum-segédek (Europe/Budapest) ----
const bpDate = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Budapest' }).format(d); // YYYY-MM-DD
const isoWeek = (ymd) => {
  const [y, m, dd] = ymd.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1, dd));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const start = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - start) / 86400000 + 1) / 7);
};
const today = bpDate(NOW);
const yesterday = bpDate(new Date(NOW.getTime() - 86400000));
const HU_MONTHS = ['január','február','március','április','május','június','július','augusztus','szeptember','október','november','december'];
const HU_DAYS = ['vasárnap','hétfő','kedd','szerda','csütörtök','péntek','szombat'];
const huDate = (ymd) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return `${y}. ${HU_MONTHS[m - 1]} ${String(d).padStart(2, '0')}., ${HU_DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}`;
};

// ---- DNS: rendszer-resolver, ha nem megy, DNS-over-HTTPS ----
async function resolve(name, type) {
  try {
    const r = new dns.Resolver(); r.setServers(['1.1.1.1', '8.8.8.8']);
    if (type === 'A') return await r.resolve4(name);
    if (type === 'CNAME') return await r.resolveCname(name);
    if (type === 'MX') return (await r.resolveMx(name)).map((x) => x.exchange);
    if (type === 'TXT') return (await r.resolveTxt(name)).map((x) => x.join(''));
  } catch (e) {
    if (e.code === 'ENODATA' || e.code === 'ENOTFOUND') return [];
    const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${name}&type=${type}`, { headers: { accept: 'application/dns-json' } });
    const j = await res.json();
    const want = { A: 1, CNAME: 5, MX: 15, TXT: 16 }[type];
    return (j.Answer || []).filter((a) => a.type === want).map((a) => type === 'MX' ? a.data.split(' ')[1] : a.data.replace(/^"|"$/g, ''));
  }
}

function peerCert(host) {
  return new Promise((ok, fail) => {
    const s = tls.connect({ host, port: 443, servername: host, rejectUnauthorized: false, timeout: 15000 }, () => {
      const c = s.getPeerCertificate(); const authorized = s.authorized; s.end();
      ok({ cn: c.subject && c.subject.CN, san: c.subjectaltname || '', validTo: new Date(c.valid_to), authorized, authError: s.authorizationError });
    });
    s.on('error', fail); s.on('timeout', () => { s.destroy(); fail(new Error('TLS timeout')); });
  });
}

async function main() {
  // 1. DNS
  const a = await resolve(HOST, 'A');
  check('DNS: apex A rekordok csak GitHub-IP-k', a.length > 0 && a.every((ip) => GH_IPS.includes(ip)), a.join(', ') || 'nincs A rekord');
  const cn = await resolve(`www.${HOST}`, 'CNAME');
  check('DNS: www CNAME -> muellah.github.io', cn.some((c) => c.replace(/\.$/, '') === 'muellah.github.io'), cn.join(', ') || 'nincs CNAME');
  const mx = await resolve(HOST, 'MX');
  check('DNS: MX megvan (levelezés)', mx.some((m) => /mx\.dotroll\.com\.?$/.test(m)), mx.join(', ') || 'NINCS MX, a levelezés nem megy');
  const txt = await resolve(HOST, 'TXT');
  check('DNS: Google-verifikációs TXT megvan', txt.some((t) => t.includes('google-site-verification')), txt.length ? 'megvan' : 'hiányzik');

  // 2. TLS-tanúsítvány
  try {
    const c = await peerCert(HOST);
    const days = Math.floor((c.validTo - NOW) / 86400000);
    check('TLS: tanúsítvány a domainre szól és érvényes', c.authorized && /hanyadikhetvan\.hu/.test(c.san), `CN=${c.cn}; ${c.san}; ${c.authorized ? 'érvényes' : 'NEM érvényes: ' + c.authError}`);
    check('TLS: legalább 14 nap van hátra a lejáratig', days >= 14, `${days} nap (lejár ${c.validTo.toISOString().slice(0, 10)}; a GitHub magától megújítja)`);
  } catch (e) { check('TLS: tanúsítvány a domainre szól és érvényes', false, e.message); }

  // 3. Átirányítások
  const r1 = await fetch(`http://${HOST}/`, { redirect: 'manual' });
  check('HTTP -> HTTPS átirányítás', r1.status === 301 && (r1.headers.get('location') || '').startsWith(`https://${HOST}`), `${r1.status} -> ${r1.headers.get('location')}`);
  const r2 = await fetch(`https://www.${HOST}/`, { redirect: 'manual' });
  check('www -> apex átirányítás', r2.status === 301 && (r2.headers.get('location') || '').startsWith(`https://${HOST}`), `${r2.status} -> ${r2.headers.get('location')}`);

  // 4. Az oldal maga
  let html;
  if (process.env.HC_HTML) html = fs.readFileSync(process.env.HC_HTML, 'utf8');
  else {
    const r = await fetch(`https://${HOST}/`);
    html = await r.text();
    check('Oldal: HTTP 200 a GitHub Pages-ről', r.status === 200 && /github/i.test(r.headers.get('server') || ''), `${r.status}, server: ${r.headers.get('server')}`);
  }
  check('Oldal: a cím a helyes', html.includes('<title>Hányadik hét van?</title>'), 'title');
  const hWeek = +((html.match(/id="hetszam">(\d+)\./) || [])[1]);
  const hPar = (html.match(/id="parossag">([^<]+)</) || [])[1];
  const hTitle = (html.match(/id="datum" title="(\d{8})"/) || [])[1];
  const hYmd = hTitle ? `${hTitle.slice(0, 4)}-${hTitle.slice(4, 6)}-${hTitle.slice(6, 8)}` : null;
  check('HTML: a beégetett dátum friss (ma vagy tegnap, Budapest)', hYmd === today || hYmd === yesterday,
    `HTML dátum: ${hYmd}; ma: ${today}${hYmd === yesterday ? ' (tegnapi: normális, ha a napi build még nem futott le)' : ''}`);
  check('HTML: a hétszám helyes a beégetett dátumra', hYmd && hWeek === isoWeek(hYmd), `HTML: ${hWeek}. hét; ${hYmd} ISO-hete: ${hYmd ? isoWeek(hYmd) : '?'}`);
  check('HTML: a páros/páratlan jelzés stimmel', hPar === (hWeek % 2 === 0 ? 'páros' : 'páratlan'), `${hPar}`);

  // 5. Amit a LÁTOGATÓ lát: az oldal saját JavaScriptje, a valódi "most" idővel
  const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]).find((s) => s.includes('hetszam'));
  if (!script) check('Látogató: a JS biztonsági háló megvan', false, 'nincs meg a script');
  else {
    const el = { hetszam: { textContent: '' }, parossag: { textContent: '' }, datum: { title: '', small: { textContent: '' } } };
    el.datum.getElementsByTagName = () => [el.datum.small];
    const RealDate = Date;
    class FakeDate extends RealDate { constructor(...a) { super(...(a.length ? a : [NOW.getTime()])); } static now() { return NOW.getTime(); } }
    vm.runInNewContext(script, { document: { getElementById: (id) => el[id] }, Date: FakeDate, Intl, Math });
    const wantWeek = isoWeek(today);
    check('Látogató: a képernyőn a mai hét látszik', el.hetszam.textContent === `${wantWeek}.`, `látszik: ${el.hetszam.textContent} | kell: ${wantWeek}.`);
    check('Látogató: a képernyőn a mai dátum látszik', el.datum.small.textContent === huDate(today), `látszik: "${el.datum.small.textContent}" | kell: "${huDate(today)}"`);
  }

  // 6. Eszközök
  if (!process.env.HC_HTML) for (const p of ['style.css', 'img/bg.png', 'img/exclamation.png', 'img/share.png', 'robots.txt']) {
    const r = await fetch(`https://${HOST}/${p}`);
    check(`Eszköz: /${p}`, r.status === 200, `${r.status}`);
  }

  // 7. Az automatizmus: lefutottak-e a napi workflow-k
  for (const wf of ['pages.yml', 'build.yml']) {
    try {
      const j = await (await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${wf}/runs?per_page=1&status=completed`, { headers: { accept: 'application/vnd.github+json' } })).json();
      const run = (j.workflow_runs || [])[0];
      const hours = run ? (NOW - new Date(run.created_at)) / 3600000 : Infinity;
      check(`Automatizmus: ${wf} legutóbbi futása sikeres és 30 órán belüli`, run && run.conclusion === 'success' && hours <= 30,
        run ? `${run.conclusion}, ${hours.toFixed(1)} órája (${run.event})` : 'nincs futás');
    } catch (e) { check(`Automatizmus: ${wf}`, false, e.message); }
  }
}

try { await main(); } catch (e) { check('A check maga lefutott', false, e.stack); }
const failed = results.filter((r) => !r.ok);
console.log(`# hanyadikhetvan.hu ellenőrzés: ${failed.length ? 'HIBA' : 'MINDEN RENDBEN'}`);
console.log(`Időpont: ${NOW.toISOString()} (Budapest: ${today})\n`);
console.log('| | Ellenőrzés | Részlet |\n|---|---|---|');
for (const r of results) console.log(`| ${r.ok ? 'OK' : '**HIBA**'} | ${r.name} | ${String(r.detail).replace(/\|/g, '/').replace(/\n/g, ' ')} |`);
console.log(`\nRESULT_JSON ${JSON.stringify({ ok: failed.length === 0, failed: failed.map((f) => f.name), total: results.length })}`);
process.exit(failed.length ? 1 : 0);
