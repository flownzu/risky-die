# Risky Die

Foundry-VTT-Mod (v14, läuft auch auf v13): Spieler können für einen Wurf einen **riskanten W20** wählen. Er hat mehr Einsen und mehr Zwanzigen, dafür fehlen die Seiten daneben.

| Einstellung „Anzahl“ | Seiten | Chance auf 1 / 20 |
|---|---|---|
| 2 (Standard) | 1, 1, 3 … 18, 20, 20 | je 10 % |
| 3 | 1, 1, 1, 4 … 17, 20, 20, 20 | je 15 % |
| 10 | zehnmal 1, zehnmal 20 | je 50 % |

Der Durchschnitt bleibt immer 10,5. Der Würfel ist nicht besser, nur riskanter.

## Bedienung

- Über der Spielerliste (unten links) erscheint die Schaltfläche **„Riskanter W20“**. Ein Klick schaltet sie scharf, der nächste W20-Wurf ist riskant. Danach setzt sie sich zurück (abschaltbar).
- Ein riskanter Wurf bekommt im Chat einen Hinweis, damit der Tisch sieht, womit gewürfelt wurde.
- Optional gibt es ein Tastenkürzel (Einstellungen → Steuerung → „Riskanten W20 scharf schalten“).

### Verfügbarkeit (GM-Einstellung)

- **Nur wenn der GM ihn freigibt** (Standard): Der GM schaltet über dieselbe Schaltfläche die Freigabe an oder aus, etwa für eine bestimmte Szene. Shift+Klick lässt den GM selbst riskant würfeln.
- **Immer**: Spieler können ihn jederzeit wählen.
- **Nie**: Mod ist praktisch aus.

### Welche Würfe

Standardmäßig nur die W20-Proben des dnd5e-Systems (abgeglichen mit dem Quellcode von dnd5e 5.3 und 6.0, im Spiel noch nicht getestet): Angriffe, Attributs- und Fertigkeitsproben, Rettungswürfe. Vorteil, Nachteil und Halfling Lucky funktionieren normal; jeder einzelne W20 wird riskant gewürfelt. Kritische Treffer und Patzer erkennt dnd5e wie gewohnt.

Wird die Einstellung „Nur W20-Proben“ abgeschaltet, gilt der riskante Würfel für jeden W20, auch `/r 1d20`.

## Wie es funktioniert

Der Würfel wird normal geworfen. Das Ergebnis wird dann auf die riskanten Seiten abgebildet: Bei Anzahl 2 wird aus einer 2 eine 1 und aus einer 19 eine 20. Weil jede Seite gleich wahrscheinlich ist, entspricht das genau einem Wurf mit dem umbeschrifteten Würfel. Das gilt auch für Dice So Nice und manuell eingegebene Würfe. Dice So Nice zeigt das abgebildete Ergebnis.

Für Makros gibt es eine kleine API:

```js
const api = game.modules.get("risky-die").api;
api.arm();              // nächsten W20 riskant würfeln
api.disarm();
api.toggle();
api.setUnlocked(true);  // nur GM: Freigabe setzen
api.faceList(3);        // [1, 1, 1, 4, …, 17, 20, 20, 20]
```

## Installation

**Manifest-URL** (nach dem ersten GitHub-Release):

```
https://github.com/flownzu/risky-die/releases/latest/download/module.json
```

Ein Release entsteht, wenn ein Tag wie `v0.1.0` gepusht wird (`git tag v0.1.0 && git push origin v0.1.0`) oder der Workflow „Release“ auf GitHub unter Actions mit einer Version von Hand gestartet wird. Der Workflow `release.yml` baut dann `module.json` und `risky-die.zip` und legt das Release an.

**Zum Testen ohne Release:** den Ordner nach `Data/modules/risky-die/` kopieren und die Mod in der Welt aktivieren.

## Entwicklung

```
npm test
```

Die Würfellogik (`scripts/mapping.mjs`) und die Patches (`scripts/core.mjs`) sind ohne Foundry testbar. `scripts/main.mjs` verbindet sie mit Einstellungen, Schaltfläche und Chat.

## Bekannte Grenzen des Prototyps

- Die Prüfung, ob ein Spieler riskant würfeln darf, läuft im Browser des Spielers. Für einen Tisch unter Freunden reicht das; der Chat-Hinweis macht jeden riskanten Wurf sichtbar.
- Die Freigabe gilt für alle Spieler gemeinsam, nicht pro Charakter.
- Dice So Nice zeigt einen normalen W20 mit dem abgebildeten Ergebnis, keine eigenen Seiten mit zwei 20ern.
