/* Site du solaire belge (v2) : lit data/donnees.json (fabriqué par belgique/site_be.py).
   Onglets : Prévision (demain + tout l'historique, modèle au choix, courbes à cocher), Résultats (comparatif des modèles et d'Elia), Comment lire. */
const $ = (id) => document.getElementById(id);
const etat = { d: null, langue: "fr", onglet: "prevision", periode: "60", modele: "BE5", modeleR: "BE5", jour: null, graphs: {},
  cases: { fourchette: true, reel: true, elia: true, elia_f: false, naif: false, autres: false } };
const FR = () => etat.langue === "fr";
const t = (fr, en) => (FR() ? fr : en);
function lire(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function ecrire(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* sans effet */ } }
const nb = (x, d = 0) => (x == null || isNaN(x) ? "–" : x.toLocaleString(FR() ? "fr-FR" : "en-GB", { minimumFractionDigits: d, maximumFractionDigits: d }));
const pc = (x, d = 0) => (x == null || isNaN(x) ? "–" : nb(100 * x, d) + " %");
const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const moy = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN);
const dateLongue = (j) => new Date(j + "T12:00:00").toLocaleDateString(FR() ? "fr-FR" : "en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const court = (j) => new Date(j + "T12:00:00").toLocaleDateString(FR() ? "fr-FR" : "en-GB", { day: "numeric", month: "short", year: j.slice(0, 4) === (etat.d.demain || "").slice(0, 4) ? undefined : "numeric" });
const signe = (x) => (x == null || isNaN(x) ? "–" : x < 0 ? `<span class="bon">${pc(x, 1)}</span>` : `<span class="mauvais">+${pc(x, 1)}</span>`);
const couleur = (m) => css("--m-" + m);
const jours = () => Object.keys(etat.d.jours).sort();
const MODELES = () => etat.d.modeles;
const DESCR = {
  BE5: ["notre meilleur modèle, en service depuis le 26/11/2026", "our best model, live since 26/11/2026"],
  BE4: ["modèle précédent", "previous model"],
  BE3: ["troisième version", "third version"],
  BE2: ["deuxième version (secours)", "second version (backup)"],
  BE1: ["première version", "first version"],
};
function heures(X) {
  if (X.t) return X.t;
  const out = [];
  for (let i = X.i0; i < X.i0 + X.reel.length; i++) out.push(String(Math.floor(i / 4)).padStart(2, "0") + ":" + String((i % 4) * 15).padStart(2, "0"));
  return out;
}

/* ------------------------------------------------------------ graphique */
function graphique(id, labels, S) {
  if (etat.graphs[id]) etat.graphs[id].destroy();
  const ds = [], ligne = (label, data, c, o = {}) => ds.push({ label, data, borderColor: c, borderWidth: 2, pointRadius: 0, fill: false, tension: 0.25, ...o });
  const bande = (cle, haut, bas, fond) => { ds.push({ label: cle + "_h", data: haut, borderWidth: 0, pointRadius: 0, fill: "+1", backgroundColor: fond, tension: 0.25 }); ds.push({ label: cle + "_b", data: bas, borderWidth: 0, pointRadius: 0, fill: false, tension: 0.25 }); };
  if (S.eliaF) bande("elia", S.eliaF[1], S.eliaF[0], css("--bande-elia"));
  if (S.nousF) bande("nous", S.nousF[1], S.nousF[0], css("--bande-nous"));
  (S.autres || []).forEach(([m, d]) => ligne(m, d, couleur(m), { borderWidth: 1.4 }));
  if (S.naif) ligne(t("Repère naïf", "Naive"), S.naif, css("--s-naif"), { borderDash: [2, 3], borderWidth: 1.6 });
  if (S.elia) ligne("Elia", S.elia, css("--s-elia"), { borderDash: [6, 4] });
  if (S.nous) ligne(S.nous[0], S.nous[1], couleur(S.nous[0]), { borderWidth: 2.8 });
  if (S.reel) ligne(t("Production réelle", "Actual output"), S.reel, css("--s-reel"), { tension: 0.15 });
  const noms = { nous_h: t("notre fourchette haute", "our upper band"), nous_b: t("notre fourchette basse", "our lower band"), elia_h: t("fourchette haute d'Elia", "Elia upper band"), elia_b: t("fourchette basse d'Elia", "Elia lower band") };
  etat.graphs[id] = new Chart($(id), {
    type: "line", data: { labels, datasets: ds },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false, interaction: { mode: "index", intersect: false },
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ` ${noms[c.dataset.label] || c.dataset.label} : ${nb(c.parsed.y)} MW` } } },
      scales: {
        x: { grid: { color: css("--grid") }, ticks: { color: css("--muted"), maxTicksLimit: 12 } },
        y: { beginAtZero: true, grid: { color: css("--grid") }, ticks: { color: css("--muted"), callback: (v) => nb(v) }, title: { display: true, text: "MW", color: css("--muted") } },
      },
    },
  });
}

/* ------------------------------------------------------------ onglet Prévision */
function modeleDuJour(X) {
  if (X.m[etat.modele]) return etat.modele;
  return MODELES().find((m) => X.m[m]);
}
function afficherPrevision() {
  const J = jours();
  if (!etat.jour || !etat.d.jours[etat.jour]) etat.jour = etat.d.demain && etat.d.jours[etat.d.demain] ? etat.d.demain : J[J.length - 1];
  const j = etat.jour, X = etat.d.jours[j], m = modeleDuJour(X), P = X.m[m];
  $("j-date").min = J[0]; $("j-date").max = J[J.length - 1]; $("j-date").value = j;
  $("j-demain").textContent = t("Revenir à demain", "Back to tomorrow");
  $("j-demain").hidden = j === etat.d.demain;
  const direct = P.src === "direct";
  $("j-badge").textContent = direct ? t("Prévu en direct", "Live forecast") : t("Refait sur le passé", "Replayed on past data");
  $("d-titre").textContent = (j === etat.d.demain ? t("Demain : production solaire du ", "Tomorrow: solar output on ") : t("Production solaire du ", "Solar output on ")) + dateLongue(j);
  const maj = etat.d.maj.split(" ");
  $("maj").textContent = X.calcule_le
    ? t(`Prévision calculée le ${court(X.calcule_le.slice(0, 10))} à ${X.calcule_le.slice(11).replace(":", " h ")}, avant l'heure limite de 10 h`, `Forecast computed on ${court(X.calcule_le.slice(0, 10))} at ${X.calcule_le.slice(11)}, before the 10 am deadline`)
    : t(`Site mis à jour le ${court(maj[0])} à ${maj[1].replace(":", " h ")}`, `Site updated on ${court(maj[0])} at ${maj[1]}`);
  const al = [];
  if (m !== etat.modele) al.push(t(`${etat.modele} n'existe pas pour ce jour : ${m} affiché à la place.`, `${etat.modele} is not available for this day: showing ${m}.`));
  if (direct && X.principal && X.principal !== "BE5" && j === etat.d.demain) al.push(t(`Modèle de secours utilisé aujourd'hui (${X.principal}).`, `Backup model used today (${X.principal}).`));
  $("d-alerte").hidden = !al.length; $("d-alerte").textContent = al.join(" ");
  // choix du modèle
  $("etiq-modele").textContent = t("Notre modèle", "Our model");
  $("d-modele").innerHTML = MODELES().map((k) => `<button type="button" data-m="${k}" aria-pressed="${k === m}" ${X.m[k] ? "" : "disabled"} title="${t(...DESCR[k])}">${k}</button>`).join("");
  $("d-modele").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => { etat.modele = b.dataset.m; afficherPrevision(); }));
  // courbes à cocher
  const aReel = X.reel.some((v) => v != null), aElia = X.e50.some((v) => v != null), autres = MODELES().filter((k) => k !== m && X.m[k]);
  const eliaNom = X.elia_src === "matin" ? t("Prévision d'Elia (matin)", "Elia's forecast (morning)") : t("Prévision d'Elia (veille, 11 h)", "Elia's forecast (day before, 11 am)");
  const C = [
    ["fourchette", `<i class="bande" style="background:var(--bande-nous)"></i>${t("Notre fourchette", "Our range")}`, true],
    ["reel", `<i style="color:var(--s-reel)"></i>${t("Production réelle", "Actual output")}`, aReel],
    ["elia", `<i class="tirets" style="color:var(--s-elia)"></i>${eliaNom}`, aElia],
    ["elia_f", `<i class="bande" style="background:var(--bande-elia)"></i>${t("Fourchette d'Elia", "Elia's range")}`, aElia],
    ["naif", `<i style="color:var(--s-naif)"></i>${t("Repère naïf (la veille)", "Naive benchmark (day before)")}`, !!X.nv],
    ["autres", `${autres.map((k) => `<i style="color:var(--m-${k})"></i>`).join("")}${t("Nos autres modèles", "Our other models")}`, autres.length > 0],
  ];
  $("etiq-courbes").textContent = t("Afficher", "Show");
  $("d-cases").innerHTML = C.map(([k, l, ok]) => `<label class="be-case${ok ? "" : " inactif"}"><input type="checkbox" data-c="${k}" ${etat.cases[k] && ok ? "checked" : ""} ${ok ? "" : "disabled"}>${l}</label>`).join("");
  $("d-cases").querySelectorAll("input").forEach((i) => i.addEventListener("change", () => { etat.cases[i.dataset.c] = i.checked; ecrire("cases_be", JSON.stringify(etat.cases)); afficherPrevision(); }));
  const c = etat.cases;
  graphique("d-graph", heures(X), {
    nous: [m, P.q50], nousF: c.fourchette ? [P.q10, P.q90] : null,
    reel: c.reel && aReel ? X.reel : null, elia: c.elia && aElia ? X.e50 : null, eliaF: c.elia_f && aElia ? [X.e10, X.e90] : null,
    autres: c.autres ? autres.map((k) => [k, X.m[k].q50]) : [], naif: c.naif && X.nv ? X.nv : null,
  });
  $("d-note").textContent = t("Heures de Bruxelles, au quart d'heure. La fourchette contient la production 8 fois sur 10. Utilisez ‹ ›, les flèches du clavier ou le calendrier pour remonter les jours.",
    "Brussels time, quarter-hourly. The range should contain actual output 8 times out of 10. Use ‹ ›, the arrow keys or the calendar to browse past days.");
  // tuiles : chaque prévision avec son erreur (comme le site du prix)
  const L = heures(X), s = X.s || {};
  const pct = (k) => (s[k] ? s[k].rmse / X.r_moy : null);
  const ecart = (k, ref) => (s[k] && s[ref] ? s[k].rmse / s[ref].rmse - 1 : null);
  const pic = (q) => { let ip = 0; q.forEach((v, i) => { if (v > q[ip]) ip = i; }); return ip; };
  const energie = (q) => q.reduce((a, v) => a + (v || 0), 0) / 4000;
  const blocErreur = (k) => {
    const titre = `<div class="petit">${t("Erreur moyenne", "Average error")} <span class="err-pas">${t("au quart d'heure", "per quarter-hour")}</span></div>`;
    if (!s[k]) return `<div class="bloc-erreur">${titre}<div class="err-attente">${t("Calculée dès que la production réelle est connue (le lendemain).", "Computed once actual output is known (the day after).")}</div></div>`;
    const d = [`<span>${t("soit", "i.e.")} ${pc(pct(k), 1)} ${t("de la production moyenne", "of average output")}</span>`];
    if (k !== "Elia" && s.Elia) d.push(`<span>${t("contre Elia :", "vs Elia:")} ${signe(ecart(k, "Elia"))}</span>`);
    if (k !== "Naif" && s.Naif) d.push(`<span>${t("contre le repère naïf :", "vs naive benchmark:")} ${signe(ecart(k, "Naif"))}</span>`);
    return `<div class="bloc-erreur">${titre}<div class="valeur erreur">${nb(s[k].rmse)} <small>MW</small></div><div class="err-detail">${d.join("")}</div></div>`;
  };
  const tuile = (cls, titre, nom, coul, q, k) => {
    const ip = pic(q);
    return `<div class="tuile modele ${cls}">${titre ? `<h3 class="titre-prevision">${titre}</h3>` : ""}<div class="libelle"><span class="pastille" style="color:${coul}"></span>${nom}</div>`
      + `<div class="duo-valeurs"><div><div class="petit">${t("ÉNERGIE SUR LA JOURNÉE", "ENERGY OVER THE DAY")}</div><div class="valeur">${nb(energie(q), 1)} <small>GWh</small></div><div class="petit">${t("pic", "peak")} ${nb(q[ip])} MW ${t("à", "at")} ${L[ip]}</div></div>`
      + (k ? blocErreur(k) : "") + `</div></div>`;
  };
  let tu = tuile("principal", t("Notre prévision", "Our forecast"), m, `var(--m-${m})`, P.q50, m);
  if (aElia) tu += tuile("", "", eliaNom, "var(--s-elia)", X.e50, X.elia_src === "11h" ? "Elia" : null);
  if (X.nv) tu += tuile("", "", t("Repère naïf : la veille", "Naive benchmark: day before"), "var(--s-naif)", X.nv, "Naif");
  if (aReel && X.s) tu += tuile("", "", t("Production réelle", "Actual output"), "var(--s-reel)", X.reel, null);
  if (!X.s) tu += `<div class="tuile"><div class="libelle">${t("Fourchette au moment du pic", "Range at peak time")}</div><div class="valeur">${nb(P.q10[pic(P.q50)])} – ${nb(P.q90[pic(P.q50)])} <small>MW</small></div>`
    + `<div class="detail">${t("La production devrait tomber dans cette fourchette 8 fois sur 10.", "Output should fall in this range 8 times out of 10.")}</div></div>`;
  $("d-tuiles").innerHTML = tu;
  // tableau du jour : tous nos modèles, Elia et le repère naïf
  $("d-table-titre").textContent = t("Comparatif des erreurs du jour", "Error comparison for the day");
  if (!X.s) {
    $("d-table").innerHTML = ""; $("d-table-note").textContent = t("La production réelle n'est pas encore connue : les scores seront calculés le lendemain matin.", "Actual output is not known yet: scores will be computed the next morning.");
    return;
  }
  const lignes = MODELES().filter((k) => s[k]).map((k) => [k, k, `var(--m-${k})`]);
  if (s.Elia) lignes.push(["Elia", t("Elia (veille, 11 h)", "Elia (day before, 11 am)"), "var(--s-elia)"]);
  if (s.Naif) lignes.push(["Naif", t("Repère naïf (la veille)", "Naive (day before)"), "var(--s-naif)"]);
  $("d-table").innerHTML = `<thead><tr><th></th><th class="nombre">${t("Erreur moyenne (MW)", "Average error (MW)")}</th><th class="nombre">${t("Erreur en %", "Error in %")}</th><th class="nombre">${t("Contre Elia", "vs Elia")}</th><th class="nombre">${t("Contre le repère naïf", "vs naive")}</th><th class="nombre">${t("Note de la fourchette", "Range score")}</th><th class="nombre">${t("Dans la fourchette", "Inside range")}</th><th class="nombre">${t("Énergie (GWh)", "Energy (GWh)")}</th></tr></thead><tbody>`
    + lignes.map(([k, n, c]) => { const v = s[k]; return `<tr class="${k === m ? "choisi" : ""}"><td><span class="pastille-m" style="color:${c}"></span>${n}${X.m[k] && X.m[k].src === "direct" ? ` <small style="color:var(--muted)">${t("direct", "live")}</small>` : ""}</td><td class="nombre">${nb(v.rmse)}</td><td class="nombre">${pc(pct(k), 1)}</td><td class="nombre">${k !== "Elia" && s.Elia ? signe(ecart(k, "Elia")) : ""}</td><td class="nombre">${k !== "Naif" && s.Naif ? signe(ecart(k, "Naif")) : ""}</td><td class="nombre">${v.wink != null ? nb(v.wink) : "–"}</td><td class="nombre">${v.couv != null ? pc(v.couv) : "–"}</td><td class="nombre">${nb(v.gwh, 1)}</td></tr>`; }).join("")
    + `<tr><td><span class="pastille-m" style="color:var(--s-reel)"></span>${t("Production réelle", "Actual output")}</td><td></td><td></td><td></td><td></td><td></td><td></td><td class="nombre">${nb(X.r_gwh, 1)}</td></tr></tbody>`;
  $("d-table-note").textContent = t("Erreur moyenne : écart typique entre la prévision et la production réelle (RMSE). Erreur en % : rapportée à la production moyenne entre le lever et le coucher du soleil. « Contre » : en vert quand l'erreur est plus petite. Repère naïf : on prévoit pour demain la production d'aujourd'hui, quart d'heure par quart d'heure (il est un peu avantagé : aujourd'hui n'est pas fini à 10 h). Il n'a pas de fourchette.",
    "Average error: typical gap between forecast and actual output (RMSE). Error in %: relative to average output between sunrise and sunset. “vs”: green when the error is smaller. Naive benchmark: tomorrow = today, quarter-hour by quarter-hour (slightly favoured: today is not over at 10 am). It has no range.");
}

/* ------------------------------------------------------------ onglet Résultats */
const PERIODES = [["30", ["30 derniers jours", "Last 30 days"]], ["60", ["2 derniers mois", "Last 2 months"]], ["avril", ["Depuis avril 2026", "Since April 2026"]], ["direct", ["En direct seulement", "Live only"]]];
function joursPeriode(p) {
  const J = jours().filter((j) => etat.d.jours[j].s && etat.d.jours[j].s.Elia);
  if (p === "direct") return J.filter((j) => Object.values(etat.d.jours[j].m).some((x) => x.src === "direct"));
  if (p === "tout") return J;
  if (p === "avril") return J.filter((j) => j >= "2026-04-04");
  return J.slice(-Number(p));
}
function resume(J, m) {
  const K = J.filter((j) => etat.d.jours[j].s[m]);
  const S = K.map((j) => etat.d.jours[j].s), g = (k, q) => moy(S.map((s) => s[k][q]));
  const KN = K.filter((j) => etat.d.jours[j].s.Naif);
  return { n: K.length, jours: K, n_rmse: moy(KN.map((j) => etat.d.jours[j].s.Naif.rmse)), m_rmse_n: moy(KN.map((j) => etat.d.jours[j].s[m].rmse)), rmse: g(m, "rmse"), e_rmse: g("Elia", "rmse"), wink: g(m, "wink"), e_wink: g("Elia", "wink"), couv: g(m, "couv"), e_couv: g("Elia", "couv"),
    prod: moy(K.map((j) => etat.d.jours[j].r_moy)), gagnes: S.filter((s) => s[m].rmse < s.Elia.rmse).length };
}
function afficherResultats() {
  $("r-intro").textContent = t("Chaque jour, nos prévisions sont comparées à la production réellement mesurée, et à la prévision officielle publiée la veille à 11 h par le gestionnaire du réseau belge (Elia). Plus l'erreur est petite, mieux c'est.",
    "Every day our forecasts are compared with measured production, and with the official forecast published the day before at 11 am by the Belgian grid operator (Elia). Lower error is better.");
  $("r-periode").innerHTML = PERIODES.map(([k, l]) => `<button type="button" data-p="${k}" aria-pressed="${etat.periode === k}">${t(...l)}</button>`).join("");
  $("r-periode").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => { etat.periode = b.dataset.p; afficherResultats(); }));
  const J = joursPeriode(etat.periode);
  if (!J.length) {
    $("r-chiffres").innerHTML = `<div class="be-chiffre"><div class="sous">${t("Pas encore de jour complet sur cette période : la production réelle d'un jour est connue le lendemain.", "No complete day yet for this period: actual output is known the day after.")}</div></div>`;
    ["r-table", "r-mois"].forEach((id) => { $(id).innerHTML = ""; });
    $("r-note").textContent = ""; if (etat.graphs["r-ecarts"]) etat.graphs["r-ecarts"].destroy();
    return;
  }
  const dispo = MODELES().filter((k) => resume(J, k).n > 0);
  if (!dispo.includes(etat.modeleR)) etat.modeleR = dispo[0];
  const m = etat.modeleR, R = resume(J, m);
  $("r-chiffres").innerHTML =
    `<div class="be-chiffre"><div class="petit">${t("Erreur moyenne de", "Average error of")} ${m}</div><div class="grand">${nb(R.rmse)} <small>MW</small></div><div class="sous">${t("soit", "i.e.")} ${pc(R.rmse / R.prod, 1)} ${t("de la production moyenne de jour", "of average daytime output")}</div></div>`
    + `<div class="be-chiffre"><div class="petit">${t("Par rapport à Elia", "Compared with Elia")}</div><div class="grand">${signe(R.rmse / R.e_rmse - 1)}</div><div class="sous">${t("d'erreur (Elia :", "error (Elia:")} ${nb(R.e_rmse)} MW)</div></div>`
    + `<div class="be-chiffre"><div class="petit">${t("Par rapport au repère naïf", "Compared with the naive benchmark")}</div><div class="grand">${signe(R.m_rmse_n / R.n_rmse - 1)}</div><div class="sous">${t("d'erreur (repère naïf :", "error (naive:")} ${nb(R.n_rmse)} MW)</div></div>`
    + `<div class="be-chiffre"><div class="petit">${t("Fourchettes par rapport à Elia", "Ranges compared with Elia")}</div><div class="grand">${signe(R.wink / R.e_wink - 1)}</div><div class="sous">${t("sur la note de la fourchette", "on the range score")}</div></div>`
    + `<div class="be-chiffre"><div class="petit">${t("Jours où", "Days where")} ${m} ${t("bat Elia", "beats Elia")}</div><div class="grand">${R.gagnes} <small>/ ${R.n}</small></div><div class="sous">${pc(R.gagnes / R.n)} ${t("des jours", "of days")}</div></div>`;
  // comparatif des modèles (chacun sur ses jours, comparé à Elia sur les mêmes jours)
  $("r-comp-titre").textContent = t("Comparatif de nos modèles (cliquez sur une ligne pour le détail)", "Our models compared (click a row for details)");
  const KN = J.filter((j) => etat.d.jours[j].s.Naif);
  const RE = { n: J.length, rmse: moy(J.map((j) => etat.d.jours[j].s.Elia.rmse)), couv: moy(J.map((j) => etat.d.jours[j].s.Elia.couv)), prod: moy(J.map((j) => etat.d.jours[j].r_moy)),
    vsN: moy(KN.map((j) => etat.d.jours[j].s.Elia.rmse)) / moy(KN.map((j) => etat.d.jours[j].s.Naif.rmse)) - 1 };
  const RN = { n: KN.length, rmse: moy(KN.map((j) => etat.d.jours[j].s.Naif.rmse)), prod: moy(KN.map((j) => etat.d.jours[j].r_moy)),
    vsE: moy(KN.map((j) => etat.d.jours[j].s.Naif.rmse)) / moy(KN.map((j) => etat.d.jours[j].s.Elia.rmse)) - 1 };
  const td = (x) => `<td class="nombre">${x}</td>`;
  $("r-table").innerHTML = `<thead><tr><th>${t("Prévision", "Forecast")}</th><th class="nombre">${t("Jours", "Days")}</th><th class="nombre">${t("Erreur moyenne (MW)", "Average error (MW)")}</th><th class="nombre">${t("Erreur en %", "Error in %")}</th><th class="nombre">${t("Contre Elia", "vs Elia")}</th><th class="nombre">${t("Contre le repère naïf", "vs naive")}</th><th class="nombre">${t("Fourchettes contre Elia", "Ranges vs Elia")}</th><th class="nombre">${t("Dans la fourchette", "Inside range")}</th><th class="nombre">${t("Jours gagnés contre Elia", "Days won vs Elia")}</th></tr></thead><tbody>`
    + dispo.map((k) => { const r = resume(J, k); return `<tr class="cliquable ${k === m ? "choisi" : ""}" data-m="${k}" title="${t(...DESCR[k])}"><td><span class="pastille-m" style="color:var(--m-${k})"></span>${k}${k === "BE5" ? ` <small style="color:var(--muted)">${t("en service", "live")}</small>` : ""}</td>`
      + td(r.n) + td(nb(r.rmse)) + td(pc(r.rmse / r.prod, 1)) + td(signe(r.rmse / r.e_rmse - 1)) + td(signe(r.m_rmse_n / r.n_rmse - 1)) + td(signe(r.wink / r.e_wink - 1)) + td(pc(r.couv)) + td(`${r.gagnes} / ${r.n}`) + `</tr>`; }).join("")
    + `<tr><td><span class="pastille-m" style="color:var(--s-elia)"></span>Elia <small style="color:var(--muted)">${t("veille 11 h", "11 am")}</small></td>` + td(RE.n) + td(nb(RE.rmse)) + td(pc(RE.rmse / RE.prod, 1)) + td("") + td(signe(RE.vsN)) + td("") + td(pc(RE.couv)) + td("") + `</tr>`
    + (RN.n ? `<tr><td><span class="pastille-m" style="color:var(--s-naif)"></span>${t("Repère naïf", "Naive benchmark")} <small style="color:var(--muted)">${t("la veille", "day before")}</small></td>` + td(RN.n) + td(nb(RN.rmse)) + td(pc(RN.rmse / RN.prod, 1)) + td(signe(RN.vsE)) + td("") + td("") + td("–") + td("") + `</tr>` : "")
    + `</tbody>`;
  $("r-table").querySelectorAll("tr[data-m]").forEach((tr) => tr.addEventListener("click", () => { etat.modeleR = tr.dataset.m; afficherResultats(); }));
  const nd = J.filter((j) => Object.values(etat.d.jours[j].m).some((x) => x.src === "direct")).length;
  $("r-note").textContent = t(`${J.length} jours, du ${court(J[0])} au ${court(J[J.length - 1])} : ${nd} prévus en direct, les autres refaits sur le passé comme si on était la veille au matin. Tous les modèles, Elia et le repère naïf sont jugés sur les mêmes jours. Erreur en % = erreur moyenne / production moyenne entre le lever et le coucher du soleil. Repère naïf : on prévoit pour demain la production d'aujourd'hui (même quart d'heure) ; il sert à mesurer ce que les modèles apportent.`,
    `${J.length} days, ${court(J[0])} to ${court(J[J.length - 1])}: ${nd} forecast live, the others replayed as if it were the morning before. All models, Elia and the naive benchmark are scored on the same days. Error in % = average error / average output between sunrise and sunset. Naive benchmark: tomorrow = today (same quarter-hour); it measures what the models add.`);
  // barres : écart d'erreur avec Elia, modèle choisi
  $("r-barres-titre").textContent = t(`Chaque jour : erreur de ${m} moins erreur d'Elia (MW)`, `Each day: ${m}'s error minus Elia's (MW)`);
  $("r-barres-note").textContent = t("Sous zéro (vert), nous avons fait mieux qu'Elia ce jour-là ; au-dessus (rouge), moins bien. Cliquez sur une barre pour ouvrir le jour.", "Below zero (green) we beat Elia that day; above (red) we did worse. Click a bar to open the day.");
  if (etat.graphs["r-ecarts"]) etat.graphs["r-ecarts"].destroy();
  const K = R.jours, ec = K.map((j) => etat.d.jours[j].s[m].rmse - etat.d.jours[j].s.Elia.rmse);
  etat.graphs["r-ecarts"] = new Chart($("r-ecarts"), {
    type: "bar", data: { labels: K.map(court), datasets: [{ data: ec, backgroundColor: ec.map((x) => (x < 0 ? css("--bon") : css("--mauvais"))), borderWidth: 0 }] },
    options: { responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { display: false }, tooltip: { callbacks: {
      title: (c) => dateLongue(K[c[0].dataIndex]),
      label: (c) => { const s = etat.d.jours[K[c.dataIndex]].s; return [` ${m} : ${nb(s[m].rmse)} MW`, ` Elia : ${nb(s.Elia.rmse)} MW`]; } } } },
      onClick: (e, el) => { if (el.length) { etat.jour = K[el[0].index]; etat.modele = m; location.hash = "#prevision"; } },
      scales: { x: { grid: { display: false }, ticks: { color: css("--muted"), maxTicksLimit: 12 } },
        y: { grid: { color: css("--grid") }, ticks: { color: css("--muted"), callback: (v) => nb(v) } } } },
  });
  // par mois, modèle choisi (tous les jours)
  $("r-mois-titre").textContent = t(`Par mois : ${m} contre Elia`, `By month: ${m} vs Elia`);
  const M = {};
  joursPeriode("tout").filter((j) => etat.d.jours[j].s[m]).forEach((j) => { (M[j.slice(0, 7)] = M[j.slice(0, 7)] || []).push(j); });
  $("r-mois").innerHTML = `<thead><tr><th>${t("Mois", "Month")}</th><th class="nombre">${t("Jours", "Days")}</th><th class="nombre">${t("Notre erreur (MW)", "Our error (MW)")}</th><th class="nombre">${t("Erreur d'Elia (MW)", "Elia's error (MW)")}</th><th class="nombre">${t("Contre Elia", "vs Elia")}</th><th class="nombre">${t("Contre le repère naïf", "vs naive")}</th><th class="nombre">${t("Fourchettes contre Elia", "Ranges vs Elia")}</th><th class="nombre">${t("Jours gagnés", "Days won")}</th></tr></thead><tbody>`
    + Object.keys(M).sort().reverse().map((k) => {
      const r = resume(M[k], m), nom = new Date(k + "-15").toLocaleDateString(FR() ? "fr-FR" : "en-GB", { month: "long", year: "numeric" });
      return `<tr><td>${nom}</td><td class="nombre">${r.n}</td><td class="nombre">${nb(r.rmse)}</td><td class="nombre">${nb(r.e_rmse)}</td><td class="nombre">${signe(r.rmse / r.e_rmse - 1)}</td><td class="nombre">${signe(r.m_rmse_n / r.n_rmse - 1)}</td><td class="nombre">${signe(r.wink / r.e_wink - 1)}</td><td class="nombre">${r.gagnes} / ${r.n}</td></tr>`;
    }).join("") + "</tbody>";
}

/* ------------------------------------------------------------ pied, onglets, réglages */
function pied() {
  const li = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.34V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z"></path></svg>';
  const mail = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" d="M3 5.5h18v13H3z M3.5 6l8.5 7 8.5-7"></path></svg>';
  $("pied").innerHTML = `<div class="contact"><div class="contact-qui"><span class="contact-titre">Contact</span><span class="contact-nom">Julien Mollin</span></div><div class="contact-liens">`
    + `<a class="contact-lien linkedin" href="https://www.linkedin.com/in/julien-mollin/" target="_blank" rel="noopener" aria-label="LinkedIn : Julien Mollin">${li}<span>LinkedIn</span></a>`
    + `<a class="contact-lien" href="mailto:mollinjulien@gmail.com">${mail}<span>mollinjulien@gmail.com</span></a></div></div>`
    + `<p class="mentions">${t("Réalisé avec l'aide de Claude (Anthropic). Production mesurée et prévisions d'Elia : Elia Open Data. Aucune garantie : ces prévisions ne doivent pas servir à des décisions financières ou d'exploitation.",
      "Built with the help of Claude (Anthropic). Measured output and Elia's forecasts: Elia Open Data. No warranty: these forecasts must not be used for financial or operational decisions.")}</p>`;
}
function afficher() {
  document.querySelectorAll("[role=tab]").forEach((b) => { const on = b.dataset.onglet === etat.onglet; b.setAttribute("aria-selected", on); b.tabIndex = on ? 0 : -1; });
  document.querySelectorAll(".panneau").forEach((p) => { p.hidden = p.id !== etat.onglet; });
  if (etat.onglet === "prevision") afficherPrevision();
  else if (etat.onglet === "resultats") afficherResultats();
}
function toutAfficher() {
  document.documentElement.lang = etat.langue;
  $("langue").textContent = FR() ? "EN" : "FR";
  $("langue").setAttribute("aria-label", FR() ? "Switch to English" : "Passer en français");
  $("theme").setAttribute("aria-pressed", document.documentElement.dataset.theme === "dark");
  document.title = t("Prévision de la production solaire belge à J+1", "Belgian solar power forecast, day ahead");
  pied(); afficher();
}
function lireAncre() {
  const h = location.hash.slice(1);
  etat.onglet = ["resultats", "apropos"].includes(h) ? h : "prevision";
}
function demarrer() {
  etat.langue = lire("langue_be") || "fr";
  document.documentElement.dataset.theme = lire("theme_be2") || "light";            // mode clair par défaut (demande de Julien, 26/11/2026)
  try { Object.assign(etat.cases, JSON.parse(lire("cases_be") || "{}")); } catch (e) { /* réglages par défaut */ }
  $("langue").addEventListener("click", () => { etat.langue = FR() ? "en" : "fr"; ecrire("langue_be", etat.langue); toutAfficher(); });
  $("theme").addEventListener("click", () => {
    document.documentElement.dataset.theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    ecrire("theme_be2", document.documentElement.dataset.theme); toutAfficher();
  });
  document.querySelectorAll("[role=tab]").forEach((b) => b.addEventListener("click", () => { location.hash = "#" + b.dataset.onglet; }));
  window.addEventListener("hashchange", () => { lireAncre(); afficher(); window.scrollTo(0, 0); });
  $("j-date").addEventListener("change", (e) => { if (etat.d.jours[e.target.value]) { etat.jour = e.target.value; afficherPrevision(); } });
  const pas = (k) => { const J = jours(), i = J.indexOf(etat.jour) + k; if (J[i]) { etat.jour = J[i]; afficherPrevision(); } };
  $("j-prec").addEventListener("click", () => pas(-1));
  $("j-suiv").addEventListener("click", () => pas(1));
  $("j-demain").addEventListener("click", () => { etat.jour = etat.d.demain; afficherPrevision(); });
  document.addEventListener("keydown", (e) => {
    if (etat.onglet !== "prevision" || ["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement?.tagName)) return;
    if (e.key === "ArrowLeft") pas(-1); else if (e.key === "ArrowRight") pas(1);
  });
  document.querySelector(".identite").addEventListener("click", (e) => { e.preventDefault(); location.hash = "#prevision"; });
  fetch("data/donnees.json", { cache: "no-store" })
    .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then((d) => { etat.d = d; lireAncre(); toutAfficher(); })
    .catch(() => { document.querySelector("main").innerHTML = `<p class="carte">${t("Données indisponibles pour l'instant.", "Data unavailable for now.")}</p>`; });
}
document.addEventListener("DOMContentLoaded", demarrer);
