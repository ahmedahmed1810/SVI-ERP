    /* v749 : tri et filtre par colonne — commun à tous les écrans (09c-filtres-communs.js) */
    const { CF, cfSrc, cfT, cfApply, cfHead, cfClose, cfOpenMenu, cfMakeF } = sviCfKit({ key: "bdg", shell, refresh: () => refreshAll(), toTop: () => { keepScroll.toTop = true; } });


    /* ===== ordre manuel des lignes (glisser une ligne après un appui long) :
       désignations client, lots, activités primaires et secondaires ===== */
    const RO_KEY = "svi_roworder_v1:" + String(ref);
    const roLoad = () => {
      try { return JSON.parse(localStorage.getItem(RO_KEY) || "{}") || {}; } catch (e) { return {}; }
    };
    const roSave = o => { try { localStorage.setItem(RO_KEY, JSON.stringify(o)); } catch (e) {} };
    /* appliqué quand aucun tri n'est choisi sur ce tableau */
    const roApply = (t, arr, keyOf) => {
      const st = CF[t];
      if (st && st.sort && !st.sort.def) return arr;
      const order = roLoad()[t];
      if (!order || !order.length) return arr;
      const pos = new Map(order.map((k, i) => [k, i]));
      return arr.map((x, i) => ({ x, i }))
        .sort((a, b) => {
          const pa = pos.has(keyOf(a.x)) ? pos.get(keyOf(a.x)) : Infinity;
          const pb = pos.has(keyOf(b.x)) ? pos.get(keyOf(b.x)) : Infinity;
          return pa - pb || a.i - b.i;
        }).map(o => o.x);
    };

    /* =========================================================
       REFONTE, ÉTAPE 3 (v643) : CATALOGUE UNIQUE DES COLONNES — pour chaque clé de colonne, une fois :
       w = largeur par défaut à l'écran (px), pw = poids dans les aperçus PDF, f = format (« pct » : 12,50 %).
       SVI_COL_T = largeurs par tableau (FORMAT 113 : disposition réglée par Ahmed sur l'iPad, 13/10/2026).
       Une colonne ajoutée à un tableau (liste [clé, libellé, valeur, classe]) a donc d'office : tri, filtre, largeur réglable
       et mémorisée, ordre, copie, export, aperçu (largeur et format) — il suffit de lui donner une ligne ici.
       ========================================================= */


    const detailTable = () => body && body.querySelector("table.bdg-d-table, table.ins-table, table.lk-table");

