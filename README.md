# IP Checker (Raycast Extension)

Eine Raycast Extension, die alle lokalen und öffentlichen IP- sowie Geolocation- und Netzwerk-Informationen abfragt und übersichtlich darstellt – 100 % kostenlos, ohne API-Keys.

## Reihenfolge & Angezeigte Daten:

1. **Public IPv4**: Öffentliche IPv4-Adresse (Icon: 🌐 `Icon.Globe`)
2. **Public IPv6**: Öffentliche IPv6-Adresse, falls vorhanden (Icon: 🌐 `Icon.Globe`)
3. **Local IPv4**: Lokale IPv4-Adresse im Heimnetzwerk/WLAN (Icon: ℹ️ `Icon.Info`)
4. **Local IPv6**: Lokale IPv6-Adresse / Link-Local (Icon: 🎯 `Icon.BullsEye`)
5. **Location**: `Land, Bundesland/Region, Stadt, ZIP: Postleitzahl` (Icon: 🗺️ `Icon.Map`)
6. **GeoCoordinates**: `Breitengrad , Längengrad` (Icon: 📍 `Icon.Geopin`)
7. **Timezone**: Zeitzone z. B. `Europe/Berlin` (Icon: 🕒 `Icon.Clock`)
8. **AS**: Autonomes System Identifier z. B. `AS9009` (Icon: ⛶ `Icon.Crop`)
9. **ISP**: Internet Service Provider z. B. `M247 Europe SRL` (Icon: 📡 `Icon.Livestream`)
10. **Organization**: Organisation / Hosting-Provider (Icon: 🏢 `Icon.Building`)

## Cmd+K Menü:
- **`Enter`**: Kopiert den jeweiligen Wert des gewählten Eintrags (`Copy Public IPv4`, `Copy Local IPv4`, `Copy Location`, etc.)
- **`⌘ + Enter`**: **Copy All Info** (kopiert alle Zeilen übersichtlich untereinander)
- **`⌘ + ⇧ + C`**: Alle Daten als formatiertes JSON kopieren
- **`⌘ + ⇧ + M`**: Bei GeoCoordinates direkt in Google Maps öffnen
- **`⌘ + R`**: Daten neu laden

## Wie ist das kostenlos möglich?
- **Local IPv4 & Local IPv6**: Werden direkt offline und kostenlos über das Betriebssystem via Node.js `os.networkInterfaces()` ermittelt.
- **Public IPv4 & Public IPv6**: Kostenlos und ohne API-Key über `api4.ipify.org` & `api6.ipify.org` (mit kurzem Timeout für Anschlüsse ohne IPv6).
- **Location, GeoCoordinates, AS, ISP, Organization, Timezone**: Über `http://ip-api.com` mit `lang=de` (kostenlos, kein API-Key erforderlich). Robuster Fallback über `ipwho.is` und `ipinfo.io`.

## Build
```bash
npm run build
```
Das fertige Bundle wird in den Ordner `dist/` geschrieben.
