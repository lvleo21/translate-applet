'use strict';

const Applet = imports.ui.applet;
const Settings = imports.ui.settings;
const St = imports.gi.St;
const GLib = imports.gi.GLib;

imports.searchPath.unshift(imports.ui.appletManager.appletMeta['translate-applet@lvleo21.github.io'].path);
const { TranslationModel } = imports.lib.model;
const { TranslationView } = imports.lib.view;

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------

class TranslateApplet extends Applet.IconApplet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);

        this._metadata = metadata;
        this._translationText = '';

        this._initSettings(instanceId);
        this._initModel();
        this._initView();

        this.set_applet_icon_name('preferences-desktop-locale');
        this.set_applet_tooltip('Translate (click to open)');
    }

    // --- Lifecycle ---

    on_applet_clicked() {
        this._view.reset();
        this._view.open();
    }

    on_applet_removed_from_panel() {
        this._settings.finalize();
    }

    // --- Initializers ---

    _initSettings(instanceId) {
        this._settings = new Settings.AppletSettings(this, this._metadata.uuid, instanceId);
        this._settings.bind('api-key', '_apiKey', this._onSettingsChanged.bind(this));
        this._settings.bind('groq-model', '_groqModel', this._onSettingsChanged.bind(this));
    }

    _initModel() {
        this._model = new TranslationModel(this._apiKey, this._groqModel);
    }

    _initView() {
        this._view = new TranslationView({
            onToggleDirection: this._onToggleDirection.bind(this),
            onTranslate: this._onTranslate.bind(this),
            onCopy: this._onCopy.bind(this)
        });
        this._view.setDirection(this._model.directionSource, this._model.directionTarget);
    }

    // --- Settings ---

    _onSettingsChanged() {
        this._model.updateSettings(this._apiKey, this._groqModel);
    }

    // --- Clipboard ---

    _writeClipboard(text) {
        const clipboard = St.Clipboard.get_default();
        clipboard.set_text(St.ClipboardType.CLIPBOARD, text);
    }

    // --- User action handlers ---

    _onToggleDirection() {
        this._model.toggleDirection();
        this._view.setDirection(this._model.directionSource, this._model.directionTarget);
        this._view.reset();
    }

    _onTranslate() {
        const text = this._view.getSourceText().trim();
        if (!text) {
            this._view.setError('No text to translate.');
            return;
        }

        this._view.setLoading(true);
        this._model.translate(text, (err, translation) => {
            this._view.setLoading(false);
            if (err) {
                this._view.setError(err.message);
            } else {
                this._translationText = translation;
                this._view.setTranslationText(translation);
            }
        });
    }

    _onCopy() {
        if (this._translationText) {
            this._writeClipboard(this._translationText);
            this.set_applet_tooltip('Copied!');
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 2000, () => {
                this.set_applet_tooltip('Translate (click to open)');
                return false;
            });
        }
    }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

function main(metadata, orientation, panelHeight, instanceId) {
    return new TranslateApplet(metadata, orientation, panelHeight, instanceId);
}
