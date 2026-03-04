# Digitaler Vokabelkasten (5. Klasse)

Eine einfache HTML/CSS/JavaScript-Webapp zum Vokabel-Lernen mit einem digitalen Vokabelkasten (3 Stapel).
Die Vokabeln werden aus einer Textdatei `vocab.txt` geladen.

## Features
- Vokabeln aus `data/vocab.txt` (Format: **Englisch[TAB]Deutsch**)
- Startscreen: Name, Abfragerichtung (DE→EN / EN→DE / Zufall), Schwierigkeit (Timer)
- 3 Stapel-System:
  - Start: alle Wörter in Stapel 1
  - ✅ Richtig: Stapel 1→2, Stapel 2→3
  - ❌ Falsch: zurück nach Stapel 1
  - Jede 10. Karte kommt aus Stapel 2 (wenn vorhanden)
- Button „Umdrehen“ oder automatisches Umdrehen nach Ablauf der Zeit
- Statistik: Runden, richtig/falsch, Trefferquote, schwierigste Wörter

## Projektstruktur

```
vokabelkasten/
├─ index.html
├─ css/
│  └─ style.css
├─ js/
│  └─ script.js
└─ data/
   └─ vocab.txt
```

## Vokabel-Datei (wichtig!)
Datei: `data/vocab.txt`

**Format pro Zeile:** Englisch **TAB** Deutsch  
👉 Der TAB ist ein echtes Tabulator-Zeichen (nicht mehrere Leerzeichen).

Beispiel (sichtbar mit Pfeilen):
```
apple →(TAB)→ Apfel
house →(TAB)→ Haus
school →(TAB)→ Schule
```
