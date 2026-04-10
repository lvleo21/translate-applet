# Translate Applet

A Linux Mint Cinnamon panel applet that translates clipboard text between **English** and **Brazilian Portuguese** using the [Groq LLM API](https://console.groq.com).

## Features

- Clipboard integration — reads clipboard text automatically on open
- Language toggle — switch between EN → PT-BR and PT-BR → EN
- Copy result — writes the translation back to clipboard
- Configurable Groq API key and model via applet settings

## Requirements

- Linux Mint 21+ with Cinnamon 5.x
- A [Groq API key](https://console.groq.com) (free tier available)

## Installation

```bash
# Install to user applets directory
ln -s "$(pwd)/translate-applet@lvleo21.github.io" \
      ~/.local/share/cinnamon/applets/translate-applet@lvleo21.github.io
```

Then add the applet via **System Settings → Applets**, find "Translate Applet", and add it to your panel.

## Configuration

Right-click the panel applet → **Configure...**:

| Setting | Description | Default |
|---------|-------------|---------|
| Groq API Key | Your API key from console.groq.com | *(required)* |
| Groq Model | Model ID to use for translations | `llama-3.1-8b-instant` |

Other supported models: `llama-3.3-70b-versatile`, `gemma2-9b-it`.

## Usage

1. Click the applet icon
2. Type or paste text into the input area
3. Click the **EN → PT-BR** / **PT-BR → EN** toggle to change direction
4. Click **Translate** (or wait for auto-translate after typing)
5. Click **Copy Translation** to copy the result to clipboard

## Architecture

The project follows the **MVC** pattern:

```
translate-applet@lvleo21.github.io/
├── applet.js              # Controller — wires model and view, handles Cinnamon lifecycle
├── metadata.json          # Applet metadata (uuid, name, description)
├── settings-schema.json   # Settings definition for Cinnamon settings panel
├── stylesheet.css         # Custom widget styles
└── lib/
    ├── model.js           # Model — state, Groq API calls, language direction
    └── view.js            # View — popup menu UI construction and updates
```
