const { Plugin, PluginSettingTab, Setting } = require('obsidian');

class OneClickAutocorrecter extends Plugin {
    async onload() {
        console.log("✅ One-Click Autocorrecter loaded");

        await this.loadSettings();

        // COMMAND 1: Autocorrect entire note
        this.addCommand({
            id: "autocorrect-all",
            name: "One-Click Autocorrecter: Autocorrect All",
            hotkeys: [{ modifiers: ["Alt"], key: "s" }],
            editorCallback: async (editor) => {
                const text = editor.getValue();
                if (!text.trim()) return;

                let corrected = this.quickFixes(text);
                if (this.settings.useLanguageTool)
                    corrected = await this.languageToolCorrect(corrected);

                editor.setValue(corrected);
            },
        });

        // COMMAND 2: Autocorrect selected text only
        this.addCommand({
            id: "autocorrect-selected",
            name: "One-Click Autocorrecter: Autocorrect Selected",
            hotkeys: [{ modifiers: ["Alt", "Shift"], key: "s" }],
            editorCallback: async (editor) => {
                const text = editor.getSelection();
                if (!text.trim()) return;

                let corrected = this.quickFixes(text);
                if (this.settings.useLanguageTool)
                    corrected = await this.languageToolCorrect(corrected);

                editor.replaceSelection(corrected);
            },
        });

        // Add settings tab
        this.addSettingTab(new OneClickAutocorrecterSettingTab(this.app, this));
    }

    onunload() {
        console.log("❌ One-Click Autocorrecter unloaded");
    }

    // -----------------------
    // 🔧 Core autocorrect logic
    // -----------------------
    quickFixes(text) {
        let out = text;
        out = out.replace(/\bi\b/g, "I");
        out = out.replace(/\bteh\b/gi, "the");
        out = out.replace(/\brecieve\b/gi, "receive");
        out = out.replace(/(\s)\s+/g, "$1");
        out = out.replace(/\s+([,.:;?!])/g, "$1");
        out = out.replace(/([,;:])([^\s])/g, "$1 $2");
        return out;
    }

    async languageToolCorrect(text) {
        try {
            const params = new URLSearchParams();
            params.append("text", text);
            params.append("language", this.settings.language);

            const res = await fetch(this.settings.languageToolURL, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: params,
            });

            if (!res.ok) throw new Error("LanguageTool API error: " + res.status);
            const data = await res.json();
            if (!data.matches || data.matches.length === 0) return text;

            const matches = data.matches
                .filter(m => m.replacements?.length > 0)
                .sort((a, b) => b.offset - a.offset);

            let corrected = text;
            for (const m of matches) {
                const rep = m.replacements[0].value || "";
                corrected =
                    corrected.slice(0, m.offset) +
                    rep +
                    corrected.slice(m.offset + m.length);
            }
            return corrected;
        } catch (err) {
            console.error("LanguageTool error:", err);
            return text;
        }
    }

    async loadSettings() {
        const defaults = {
            useLanguageTool: true,
            languageToolURL: "https://api.languagetool.org/v2/check",
            language: "en-US",
        };
        this.settings = Object.assign(defaults, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}

// -------------------------------
// ⚙️ Settings tab
// -------------------------------
class OneClickAutocorrecterSettingTab extends PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display() {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl("h2", { text: "One-Click Autocorrecter Settings" });

        new Setting(containerEl)
            .setName("Enable LanguageTool grammar correction")
            .setDesc("Use LanguageTool API for smarter grammar/spelling fixes (requires internet).")
            .addToggle(toggle =>
                toggle
                    .setValue(this.plugin.settings.useLanguageTool)
                    .onChange(async value => {
                        this.plugin.settings.useLanguageTool = value;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("LanguageTool API URL")
            .setDesc("Default: https://api.languagetool.org/v2/check")
            .addText(text =>
                text
                    .setPlaceholder("Enter LanguageTool server URL")
                    .setValue(this.plugin.settings.languageToolURL)
                    .onChange(async value => {
                        this.plugin.settings.languageToolURL = value;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("Language")
            .setDesc("Example: en-US, en-GB, de-DE, fr-FR")
            .addText(text =>
                text
                    .setPlaceholder("en-US")
                    .setValue(this.plugin.settings.language)
                    .onChange(async value => {
                        this.plugin.settings.language = value;
                        await this.plugin.saveSettings();
                    })
            );
    }
}

module.exports = OneClickAutocorrecter;
