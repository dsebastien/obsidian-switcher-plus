import { SwitcherPlusKeymap } from './switcherPlusKeymap';
import { getSystemSwitcherInstance } from 'src/utils';
import { ModeHandler } from './modeHandler';
import SwitcherPlusPlugin from 'src/main';
import { App, QuickSwitcherOptions } from 'obsidian';
import { AcronymSearcher } from 'src/search';
import {
  SystemSwitcher,
  SwitcherPlus,
  AnySuggestion,
  Mode,
  SessionOpts,
  ModeDispatcher,
  FileSuggestion,
  SuggestionType,
  MatchType,
} from 'src/types';

interface SystemSwitcherConstructor extends SystemSwitcher {
  new (app: App, builtInOptions: QuickSwitcherOptions): SystemSwitcher;
}

export function createSwitcherPlus(app: App, plugin: SwitcherPlusPlugin): SwitcherPlus {
  const SystemSwitcherModal = getSystemSwitcherInstance(app)
    ?.QuickSwitcherModal as SystemSwitcherConstructor;

  if (!SystemSwitcherModal) {
    console.log(
      'Switcher++: unable to extend system switcher. Plugin UI will not be loaded. Use the builtin switcher instead.',
    );
    return null;
  }

  const SwitcherPlusModal = class extends SystemSwitcherModal implements SwitcherPlus {
    private _exMode: ModeDispatcher;
    get exMode(): ModeDispatcher {
      return this._exMode;
    }

    constructor(
      app: App,
      public plugin: SwitcherPlusPlugin,
    ) {
      super(app, plugin.options.builtInSystemOptions);

      const { options } = plugin;
      options.shouldShowAlias = this.shouldShowAlias;
      const exKeymap = new SwitcherPlusKeymap(
        app,
        this.scope,
        this.chooser,
        this,
        options,
      );
      this._exMode = new ModeHandler(app, options, exKeymap);
    }

    openInMode(mode: Mode, sessionOpts?: SessionOpts): void {
      this.exMode.setSessionOpenMode(mode, this.chooser, sessionOpts);
      super.open();
    }

    onOpen(): void {
      this.exMode.onOpen();
      super.onOpen();
    }

    onClose() {
      super.onClose();
      this.exMode.onClose();
    }

    protected updateSuggestions(): void {
      const { exMode, inputEl, chooser } = this;
      exMode.insertSessionOpenModeOrLastInputString(inputEl);

      if (!exMode.updateSuggestions(inputEl.value, chooser, this)) {
        super.updateSuggestions();
      }
    }

    getSuggestions(input: string): AnySuggestion[] {
      const { exMode, plugin } = this;
      const query = exMode.inputTextForStandardMode(input);
      const results = super.getSuggestions(query);
      exMode.addPropertiesToStandardSuggestions(results, plugin.options);

      // Add acronym search results if enabled
      if (plugin.options.enableAcronymSearch && query && query.trim().length > 0) {
        const acronymResults = this.performAcronymSearch(query.trim());
        const mergedResults = this.mergeSearchResults(results, acronymResults);
        return mergedResults;
      }

      return results;
    }

    private performAcronymSearch(query: string): FileSuggestion[] {
      const acronymSearcher = new AcronymSearcher(query);
      const allFiles = this.app.vault.getFiles();
      const acronymResults: FileSuggestion[] = [];

      // Limit search to prevent performance issues with large vaults
      const maxAcronymResults = 50;

      for (const file of allFiles) {
        const result = acronymSearcher.searchWithFallback(file.name, {
          basename: file.basename,
          path: file.path,
        });

        if (result.match) {
          const fileSuggestion: FileSuggestion = {
            file,
            type: SuggestionType.File,
            match: result.match,
            // Add optional properties that might be set by addPropertiesToStandardSuggestions
            matchType: MatchType.Basename,
            matchText: file.name,
          };

          acronymResults.push(fileSuggestion);
        }
      }

      // Sort by score (higher scores first) and limit results
      return acronymResults
        .sort((a, b) => (b.match?.score || 0) - (a.match?.score || 0))
        .slice(0, maxAcronymResults);
    }

    private mergeSearchResults(
      standardResults: AnySuggestion[],
      acronymResults: FileSuggestion[],
    ): AnySuggestion[] {
      // Create a Set of file paths from standard results to avoid duplicates
      const existingFilePaths = new Set<string>();

      for (const result of standardResults) {
        if ('file' in result && result.file) {
          existingFilePaths.add(result.file.path);
        }
      }

      // Filter out acronym results that are already in standard results
      const uniqueAcronymResults = acronymResults.filter(
        (result) => !existingFilePaths.has(result.file.path),
      );

      // Apply standard properties to acronym results
      this.exMode.addPropertiesToStandardSuggestions(
        uniqueAcronymResults,
        this.plugin.options,
      );

      // Combine results - standard results first (they have higher priority)
      return [...standardResults, ...uniqueAcronymResults];
    }

    onChooseSuggestion(item: AnySuggestion, evt: MouseEvent | KeyboardEvent) {
      if (!this.exMode.onChooseSuggestion(item, evt)) {
        super.onChooseSuggestion(item, evt);
      }
    }

    renderSuggestion(value: AnySuggestion, parentEl: HTMLElement) {
      if (!this.exMode.renderSuggestion(value, parentEl)) {
        super.renderSuggestion(value, parentEl);
      }
    }
  };

  return new SwitcherPlusModal(app, plugin);
}
