# Bestelmelding-popup (7 dagen levertijd) — Shopify

Een lichte, zelfstandige pop-up voor de Shopify-winkel **morephrem.shop** die
bezoekers laat weten dat ze gewoon kunnen bestellen, maar dat bestellingen pas
**ná 7 dagen** worden verwerkt en verzonden.

![Voorbeeld](./preview-desktop.png)

## Wat het doet

- Verschijnt **één keer per browsersessie** (via `sessionStorage`) — niet bij elke
  paginaklik, zodat het niet irritant wordt.
- Sluitbaar via het kruisje, de knop **Begrepen**, een klik naast de kaart, of Esc.
- Toegankelijk (`role="dialog"`, `aria-modal`, focus op de knop, Esc-sluiten) en
  respecteert `prefers-reduced-motion`.
- Volledig zelfstandig: eigen HTML/CSS/JS met de unieke prefix `mor7d-`, dus geen
  conflict met de thema-stijlen.

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

> Het is de enige wijziging aan `theme.liquid`: één extra `render`-regel. Al het
> andere (apps, tags, scripts) is ongewijzigd.

## Publiceren (laatste stap — door de merchant)

De kopie staat klaar maar is nog **niet live**. Om hem live te zetten:

1. **Preview:** `https://morephrem.shop/?preview_theme_id=187632484733`
2. Shopify Admin → **Online Store → Themes**.
3. Zoek **"Webshop — bestelmelding (7 dagen levertijd)"** → **Actions → Publish**.

Of voeg in plaats daarvan de twee wijzigingen handmatig toe aan het live thema
(snippet uit dit mapje + de `render`-regel vóór `</body>` in `theme.liquid`).

## Tekst of gedrag aanpassen

Bovenin `delayed-orders-popup.liquid` staat een `assign`-blok:

```liquid
assign show_popup    = true      # zet op false om de pop-up (tijdelijk) uit te zetten
assign popup_version = 1          # +1 => iedereen ziet 'm opnieuw, ook wie 'm al wegklikte
assign popup_title   = 'Bestellen kan gewoon 📦'
assign popup_message = 'Je kunt je bestelling zoals altijd plaatsen. Let op: ...'
assign popup_button  = 'Begrepen'
```

## Verwijderen / terugdraaien

- Snelste weg terug: publiceer opnieuw het originele thema **"Webshop"**.
- Of in dit thema: verwijder `snippets/delayed-orders-popup.liquid` en haal de regel
  `{% render 'delayed-orders-popup' %}` uit `layout/theme.liquid` weg.
