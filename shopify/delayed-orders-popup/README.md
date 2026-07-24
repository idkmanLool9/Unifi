# Bestelmelding-popup met afteller — Shopify

Een levendige, zelfstandige pop-up voor de Shopify-winkel **morephrem.shop** die
bezoekers laat weten dat ze gewoon kunnen bestellen, maar dat hun bestelling nog
een aantal dagen levertijd heeft. **Dat aantal telt elke dag automatisch 1 omlaag**
vanaf een instelbare startdatum. Bij 0 verdwijnt de melding vanzelf.

![Voorbeeld](./preview-desktop.png)

## Wat het doet

- Toont een grote **afteller-badge** (bijv. `7 DAGEN`) plus een voortgangsbalk van
  gekleurde balkjes die elke dag korter wordt.
- De teller wordt **server-side in Liquid** berekend op basis van de winkeldatum
  (tijdzone van de winkel), dus hij klopt bij elke paginalading — er hoeft niets te
  blijven draaien en er is geen app voor nodig.
- Verschijnt **één keer per dag per bezoeker** (via `sessionStorage`, sleutel bevat
  de datum), zodat een terugkerende klant de nieuwe stand ziet.
- Sluitbaar via het kruisje, de knop **Begrepen**, een klik ernaast of Esc.
  Toegankelijk (`role="dialog"`, `aria-modal`, focus, Esc) en respecteert
  `prefers-reduced-motion`. Unieke CSS-prefix `mor7d-`, dus geen thema-conflicten.

## Hoe de afteller rekent

```
resterend = total_days − (vandaag − start_date, in hele dagen)
```

Voorbeeld met `start_date = 2026-07-24` en `total_days = 7`:

| Datum | Toont |
|---|---|
| 24-07-2026 | 7 dagen |
| 25-07-2026 | 6 dagen |
| … | … |
| 30-07-2026 | 1 dag |
| 31-07-2026 | pop-up verdwijnt (0) |

## Waar het staat (deployment)

Geïnstalleerd via de Shopify Admin GraphQL API op een **kopie** van het live thema
(schrijven naar het live/gepubliceerde thema is via de integratie geblokkeerd):

| | |
|---|---|
| Winkel | morephrem.shop |
| Thema (kopie) | **Webshop — bestelmelding (7 dagen levertijd)** |
| Thema-ID | `187632484733` |
| Snippet | `snippets/delayed-orders-popup.liquid` |
| Inhaak-punt | `layout/theme.liquid`, regel `{% render 'delayed-orders-popup' %}` vlak vóór `</body>` |

## Publiceren (laatste stap — door de merchant)

De kopie staat klaar maar is nog **niet live**:

1. **Preview:** `https://morephrem.shop/?preview_theme_id=187632484733`
2. Shopify Admin → **Online Store → Themes**.
3. Zoek **"Webshop — bestelmelding (7 dagen levertijd)"** → **Actions → Publish**.

## Instellen / aanpassen

Bovenin `delayed-orders-popup.liquid` staat het instelblok:

```liquid
assign show_popup    = true          # false = pop-up uit
assign popup_version = 2             # +1 => iedereen ziet 'm vandaag opnieuw
assign start_date    = '2026-07-24'  # dag waarop de afteller op total_days staat
assign total_days    = 7             # levertijd in dagen op de startdatum
assign popup_title   = 'Bestellen kan gewoon 🎉'
assign popup_message_pre  = 'Je kunt nu bestellen! Je bestelling wordt over'
assign popup_message_post = 'verwerkt en verzonden. Bedankt voor je geduld 🙏'
assign popup_button  = 'Begrepen'
```

> Het getal in de tekst en de badge komt uit `remaining` en telt automatisch mee.

## Verwijderen / terugdraaien

- Snelste weg terug: publiceer opnieuw het originele thema **"Webshop"**.
- Of in dit thema: verwijder `snippets/delayed-orders-popup.liquid` en haal de regel
  `{% render 'delayed-orders-popup' %}` uit `layout/theme.liquid` weg.
