'use strict';

const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Pango = imports.gi.Pango;
const GLib = imports.gi.GLib;
const ModalDialog = imports.ui.modalDialog;

const DIALOG_WIDTH = 700;
const INPUT_HEIGHT = 180;
const DEBOUNCE_MS  = 800;

// Design tokens — Forest & Slate palette
const C = {
    surface:            '#f7fafc',
    surfaceLow:         '#f1f4f6',
    surfaceContainer:   '#ebeef0',
    surfaceLowest:      '#ffffff',
    surfaceHighest:     '#e0e3e5',
    onSurface:          '#181c1e',
    onSurfaceVariant:   '#40493d',
    primary:            '#176a22',
    secondaryContainer: '#cbe7f5',
    onSecondary:        '#4e6874',
    outlineVariant:     '#bfcab9',
    outline:            '#707a6b',
    errorText:          '#9f3461',
};

var TranslationView = class TranslationView {
    constructor(callbacks) {
        this._callbacks = callbacks;
        this._widgets   = {};
        this._debounceId = null;
        this._dialog    = this._buildDialog();
    }

    // --- Public API ---

    open()  { this._dialog.open(); }
    close() { this._dialog.close(); }

    setDirection(source, target) {
        this._widgets.sourceLangBtn.set_label(source);
        this._widgets.targetLangBtn.set_label(target);
    }

    getSourceText() {
        return this._widgets.typeInput.get_text();
    }

    setTranslationText(text) {
        this._widgets.resultLabel.set_text(text || '');
        this._widgets.resultLabel.set_style(this._resultTextStyle());
        this._widgets.resultPlaceholder.visible = false;
        this._widgets.resultScroll.visible      = true;
        this._widgets.copyBtn.reactive          = true;
        this._setLiveIndicator(false);
    }

    setLoading(isLoading) {
        this._setLiveIndicator(isLoading);
    }

    setError(message) {
        this._widgets.resultLabel.set_text(`Error: ${message}`);
        this._widgets.resultLabel.set_style(
            `font-family: Inter, sans-serif; color: ${C.errorText}; font-size: 0.9em; padding: 12px 14px;`
        );
        this._widgets.resultPlaceholder.visible = false;
        this._widgets.resultScroll.visible      = true;
        this._widgets.copyBtn.reactive          = false;
        this._setLiveIndicator(false);
    }

    reset() {
        this._widgets.resultLabel.set_text('');
        this._widgets.resultScroll.visible      = false;
        this._widgets.resultPlaceholder.visible = true;
        this._widgets.copyBtn.reactive          = false;
        this._setLiveIndicator(false);
    }

    // --- Dialog construction ---

    _buildDialog() {
        const dialog = new ModalDialog.ModalDialog({ styleClass: 'translate-dialog' });

        dialog._dialogLayout.style = [
            `background-color: ${C.surface}`,
            'border-radius: 12px',
            `color: ${C.onSurface}`,
            'padding: 0',
            'box-shadow: 0 8px 32px rgba(24,28,30,0.05)'
        ].join('; ');

        const layout = dialog.contentLayout;
        layout.style = `width: ${DIALOG_WIDTH}px;`;

        this._buildHeader(layout);
        this._buildLanguageBar(layout);
        this._buildTranslationArea(layout);
        this._buildFooter(layout);

        dialog.setButtons([{
            label: 'Close',
            action: () => {
                this._widgets.typeInput.set_text('');
                this._cancelDebounce();
                this.reset();
                dialog.close();
            },
            key: Clutter.KEY_Escape,
            style_class: 'translate-close-btn',
        }]);

        return dialog;
    }

    _buildHeader(layout) {
        const header = new St.BoxLayout({
            vertical: false,
            x_expand: true,
            style: 'padding: 16px 20px 12px;'
        });

        const titleBox = new St.BoxLayout({ vertical: true, x_expand: true });

        titleBox.add_child(new St.Label({
            text: 'TranslateAI',
            style: [
                'font-family: Manrope, sans-serif',
                'font-weight: bold',
                'font-size: 1.15em',
                'color: #0f4a18',
                'letter-spacing: 0.01em'
            ].join('; ')
        }));

        titleBox.add_child(new St.Label({
            text: 'New Translation',
            style: [
                'font-family: Inter, sans-serif',
                'font-size: 0.78em',
                `color: ${C.onSurfaceVariant}`,
                'padding-top: 2px'
            ].join('; ')
        }));

        header.add_child(titleBox);
        layout.add(header, { x_fill: true });
    }

    _buildLanguageBar(layout) {
        const bar = new St.BoxLayout({
            vertical: false,
            x_expand: true,
            style: `background-color: ${C.surfaceLow}; padding: 10px 20px;`
        });

        bar.add_child(new St.Widget({ x_expand: true }));

        const innerBar = new St.BoxLayout({ vertical: false, style: 'spacing: 10px;' });

        const sourceLangBtn = new St.Button({
            label: 'English',
            style_class: 'translate-lang-chip',
            reactive: true,
            track_hover: true
        });

        const swapBtn = new St.Button({
            style_class: 'translate-swap-btn',
            reactive: true,
            track_hover: true
        });
        swapBtn.set_child(new St.Label({
            text: '⇌',
            style: `font-size: 1em; color: ${C.onSecondary};`
        }));
        swapBtn.connect('clicked', () => this._callbacks.onToggleDirection());

        const targetLangBtn = new St.Button({
            label: 'Brazilian Portuguese',
            style_class: 'translate-lang-chip',
            reactive: true,
            track_hover: true
        });

        sourceLangBtn.connect('clicked', () => this._callbacks.onToggleDirection());
        targetLangBtn.connect('clicked', () => this._callbacks.onToggleDirection());

        innerBar.add_child(sourceLangBtn);
        innerBar.add_child(swapBtn);
        innerBar.add_child(targetLangBtn);
        bar.add_child(innerBar);

        bar.add_child(new St.Widget({ x_expand: true }));

        layout.add(bar, { x_fill: true });

        this._widgets.sourceLangBtn = sourceLangBtn;
        this._widgets.targetLangBtn = targetLangBtn;
    }

    _buildTranslationArea(layout) {
        const grid = new St.BoxLayout({
            vertical: false,
            x_expand: true,
            style: `background-color: ${C.surface}; padding: 16px 20px; spacing: 14px;`
        });

        grid.add_child(this._buildInputSection());
        grid.add_child(this._buildOutputSection());

        layout.add(grid, { x_fill: true });
    }

    _buildInputSection() {
        const section = new St.BoxLayout({ vertical: true, x_expand: true, style: 'spacing: 6px;' });

        const labelRow = new St.BoxLayout({ vertical: false, style: 'padding: 0 2px;' });
        const charCount = new St.Label({
            text: '0 / 5000',
            style: `font-family: Inter, sans-serif; font-size: 0.65em; color: ${C.onSurfaceVariant};`
        });
        labelRow.add_child(new St.Label({
            text: 'SOURCE LANGUAGE',
            style: this._sectionLabelStyle(),
            x_expand: true
        }));
        labelRow.add_child(charCount);
        section.add_child(labelRow);

        const inputContainer = new St.BoxLayout({
            vertical: true,
            x_expand: true,
            style: `background-color: ${C.surfaceLow}; border-radius: 10px; padding: 2px;`
        });

        const { scroll, input } = this._makeEditableArea(INPUT_HEIGHT);
        inputContainer.add_child(scroll);
        section.add_child(inputContainer);

        input.connect('text-changed', () => {
            charCount.set_text(`${input.get_text().length} / 5000`);
        });

        this._widgets.typeInput = input;
        return section;
    }

    _buildOutputSection() {
        const section = new St.BoxLayout({ vertical: true, x_expand: true, style: 'spacing: 6px;' });

        const labelRow = new St.BoxLayout({ vertical: false, style: 'padding: 0 2px;' });

        const liveIndicator = new St.BoxLayout({ vertical: false, style: 'spacing: 3px;', visible: false });
        liveIndicator.add_child(new St.Label({
            text: '●',
            style: `font-size: 0.55em; color: ${C.primary}; padding-top: 1px;`
        }));
        liveIndicator.add_child(new St.Label({
            text: 'Translating…',
            style: `font-family: Inter, sans-serif; font-size: 0.65em; color: ${C.primary}; font-weight: 500;`
        }));

        labelRow.add_child(new St.Label({
            text: 'TRANSLATED TEXT',
            style: this._sectionLabelStyle(),
            x_expand: true
        }));
        labelRow.add_child(liveIndicator);
        section.add_child(labelRow);

        const outputContainer = new St.BoxLayout({
            vertical: true,
            x_expand: true,
            style: `background-color: ${C.surfaceContainer}; border-radius: 10px; padding: 2px;`
        });

        const contentArea = new St.BoxLayout({
            vertical: true,
            x_expand: true,
            style: `background-color: ${C.surfaceLowest}; border-radius: 8px; min-height: ${INPUT_HEIGHT}px;`
        });

        const placeholder = new St.Label({
            text: 'Translation will appear here…',
            style: [
                'font-family: Inter, sans-serif',
                `color: ${C.outline}`,
                'font-size: 0.9em',
                'padding: 12px 14px'
            ].join('; ')
        });
        contentArea.add_child(placeholder);

        const { scroll, label: resultLabel } = this._makeScrollableLabel(INPUT_HEIGHT);
        scroll.visible = false;
        contentArea.add_child(scroll);

        outputContainer.add_child(contentArea);
        section.add_child(outputContainer);

        const actionRow = new St.BoxLayout({ vertical: false, style: 'padding: 4px 2px 0;' });
        actionRow.add_child(new St.Widget({ x_expand: true }));

        const copyBtn = new St.Button({
            style_class: 'translate-icon-btn',
            reactive: false,
            track_hover: true
        });
        const copyLabel = new St.Label({
            text: '⧉  Copy',
            style: `font-family: Inter, sans-serif; font-size: 0.8em; color: ${C.onSecondary};`
        });
        copyBtn.set_child(copyLabel);
        copyBtn.connect('clicked', () => {
            this._callbacks.onCopy();
            copyLabel.set_text('✓  Copied!');
            copyBtn.reactive = false;
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => {
                copyLabel.set_text('⧉  Copy');
                copyBtn.reactive = true;
                return GLib.SOURCE_REMOVE;
            });
        });
        actionRow.add_child(copyBtn);
        section.add_child(actionRow);

        this._widgets.resultLabel       = resultLabel;
        this._widgets.resultScroll      = scroll;
        this._widgets.resultPlaceholder = placeholder;
        this._widgets.liveIndicator     = liveIndicator;
        this._widgets.copyBtn           = copyBtn;
        return section;
    }

    _buildFooter(layout) {
        const footer = new St.BoxLayout({
            vertical: false,
            x_expand: true,
            style: `background-color: ${C.surfaceLow}; padding: 8px 20px; spacing: 4px;`
        });

        [
            { text: 'Powered by ', color: C.onSurfaceVariant },
            { text: 'lvleo21',        color: C.primary, bold: true },
            { text: ' · ',         color: C.outlineVariant },
            { text: 'v0.1.0',      color: C.onSurfaceVariant },
        ].forEach(({ text, color, bold }) => {
            footer.add_child(new St.Label({
                text,
                style: [
                    'font-family: Inter, sans-serif',
                    'font-size: 0.68em',
                    `color: ${color}`,
                    bold ? 'font-weight: bold' : ''
                ].filter(Boolean).join('; ')
            }));
        });

        layout.add(footer, { x_fill: true });
    }

    // --- Helpers ---

    _setLiveIndicator(visible) {
        if (this._widgets.liveIndicator)
            this._widgets.liveIndicator.visible = visible;
    }

    _sectionLabelStyle() {
        return [
            'font-family: Inter, sans-serif',
            'font-size: 0.68em',
            'font-weight: bold',
            `color: ${C.onSurfaceVariant}`,
            'letter-spacing: 0.08em'
        ].join('; ');
    }

    _resultTextStyle() {
        return [
            'font-family: Inter, sans-serif',
            `color: ${C.onSurface}`,
            'font-size: 0.95em',
            'padding: 12px 14px'
        ].join('; ');
    }

    // --- Widget factories ---

    _makeScrollView(height) {
        const scroll = new St.ScrollView({
            style: `height: ${height}px;`,
            x_expand: true
        });
        scroll.set_policy(St.PolicyType.NEVER, St.PolicyType.AUTOMATIC);
        return scroll;
    }

    _makeScrollableLabel(height) {
        const scroll = this._makeScrollView(height);
        const box    = new St.BoxLayout({ vertical: true, x_expand: true });
        const label  = new St.Label({ text: '', x_expand: true, style: this._resultTextStyle() });
        label.clutter_text.set_line_wrap(true);
        label.clutter_text.set_selectable(true);
        box.add_child(label);
        scroll.add_actor(box);
        return { scroll, label };
    }

    _makeEditableArea(height) {
        const scroll = this._makeScrollView(height);

        const baseStyle = [
            `background-color: ${C.surfaceLowest}`,
            'border-radius: 8px',
            'padding: 12px 14px'
        ].join('; ');
        const focusStyle = baseStyle + '; box-shadow: 0 0 0 2px rgba(162,246,156,0.30)';

        const wrapper = new St.BoxLayout({ vertical: true, x_expand: true, style: baseStyle });

        const input = new Clutter.Text({
            editable: true,
            reactive: true,
            activatable: false,
            single_line_mode: false,
            line_wrap: true,
            line_wrap_mode: Pango.WrapMode.WORD_CHAR,
            selectable: true,
            x_expand: true
        });

        input.connect('key-focus-in',  () => wrapper.set_style(focusStyle));
        input.connect('key-focus-out', () => wrapper.set_style(baseStyle));

        input.connect('text-changed', () => {
            this._cancelDebounce();
            if (!input.get_text().trim()) return;
            this._debounceId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, DEBOUNCE_MS, () => {
                this._debounceId = null;
                this._callbacks.onTranslate();
                return GLib.SOURCE_REMOVE;
            });
        });

        wrapper.add_child(input);
        scroll.add_actor(wrapper);

        return { scroll, input };
    }

    _cancelDebounce() {
        if (this._debounceId !== null) {
            GLib.source_remove(this._debounceId);
            this._debounceId = null;
        }
    }
};
