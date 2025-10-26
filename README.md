# VN RSI Hangar Enhancer (Chrome Extension)

![Static Badge](https://img.shields.io/badge/Version-0.1.0-blue)
![Static Badge](https://img.shields.io/badge/License-Free%20to%20Use-green)
![Static Badge](https://img.shields.io/badge/Chrome-Extension-orange)

A lightweight **Chrome extension** that enhances the *RSI Hangar* page experience with a floating search panel, custom layout fixes, and better pagination logic.  
This extension runs locally — no remote calls, no data collection.

---

## Project Structure

```
VN RSI Hangar Enhancer/
├── icon128.jpg
├── manifest.json
├── content.js
└── content.css
```

---

## English

### Features
- Adds a right-side floating search panel that remains visible while scrolling  
- Integrates pagination logic with both RSI dropdown and user search  
- Lightweight and private — no telemetry or analytics  
- Fully local execution with minimal Chrome permissions
- No more reloads when switching pages  

---

### Requirements
- Google Chrome (latest recommended)
- Developer Mode enabled in `chrome://extensions`

---

### Installation (Load Unpacked)

1. **Download or clone** this repository:
   ```bash
   git clone https://github.com/ValkromNest/VN-RSI-Hangar-Enhancer.git
   ```
   or manually download it as a ZIP and extract it.

2. Open Chrome and go to:
   ```
   chrome://extensions
   ```

3. Turn on **Developer mode** (top-right toggle).

4. Click **"Load unpacked"** and select the folder:
   ```
   VN RSI Hangar Enhancer/
   ```

5. The extension will appear in the list.  
   (Optional) Pin it from the toolbar for easier access.

---

### Updating
- Modify your local files, then click **Reload** on the extension card in `chrome://extensions`.  
- If you’ve replaced the folder entirely, remove the old one and reload as above.

---

### Uninstalling
- Go to `chrome://extensions` → click **Remove** or toggle **Off**.

---

### Usage
- Open your **RSI Hangar** page.
- A floating search panel appears centered on the right.
- Use the **search bar** and **Search** button to filter ships or upgrades.
- Pagination will automatically adapt to both the dropdown and search filters.

---

### Privacy & Permissions
- Runs only on RSI pages (defined in `manifest.json`).
- No network connections, telemetry, or analytics.
- Minimal permissions — just enough to inject custom code.

---

## Italiano

### Funzionalità
- Aggiunge un pannello di ricerca flottante sul lato destro della pagina RSI Hangar  
- Rimane visibile durante lo scorrimento  
- Unisce la paginazione del sito con i risultati della tua ricerca  
- Nessuna raccolta dati, nessuna connessione esterna
- Nessun caricamento cambiando pagina

---

### Requisiti
- Google Chrome (versione recente)
- Modalità sviluppatore attiva (`chrome://extensions`)

---

### Installazione (Estensione non pacchettizzata)

1. **Scarica o clona** il repository:
   ```bash
   git clone https://github.com/ValkromNest/VN-RSI-Hangar-Enhancer.git
   ```
   oppure scarica il file ZIP ed estrailo.

2. Apri Chrome e vai su:
   ```
   chrome://extensions
   ```

3. Attiva **Modalità sviluppatore** (interruttore in alto a destra).

4. Clicca **Carica estensione non pacchettizzata** e seleziona la cartella:
   ```
   VN RSI Hangar Enhancer/
   ```

5. L’estensione apparirà nell’elenco (puoi anche pinnarla nella barra strumenti).

---

### Aggiornare
- Modifica i file locali e premi **Ricarica** sulla scheda dell’estensione.  
- Se hai sostituito l’intera cartella, rimuovi quella vecchia e ricarica.

---

### Disinstallare
- Vai su `chrome://extensions` → clicca **Rimuovi** o disattiva con l’interruttore.

---

### Utilizzo
- Apri la pagina del tuo **RSI Hangar**.  
- Il pannello flottante appare al centro a destra e resta visibile anche durante lo scroll.  
- Usa la **barra di ricerca** e il pulsante **Search** per filtrare le navi o gli upgrade.  
- La paginazione si adatta automaticamente ai risultati della ricerca.

---

### Privacy & Permessi
- Funziona solo sulle pagine RSI.  
- Nessun invio dati, nessuna telemetria.  
- Permessi minimi per applicare CSS e script personalizzati.

---

## Contributing
Pull requests are welcome!  
If you find a bug or want to suggest a new feature, open an issue describing:
- The problem or enhancement
- The steps to reproduce (if applicable)
- Screenshots or logs (optional)

---

## License
This project is distributed under a **Free to Use License**.  
See [LICENSE](./LICENSE) for full text.

---

### Credits
Developed with ❤️ by community members for **Star Citizen** fans.
