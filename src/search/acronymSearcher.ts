import { SearchResult } from 'obsidian';
import { PathSegments } from 'src/types';

export interface AcronymSearchResult {
  match: SearchResult | null;
  score: number;
}

export class AcronymSearcher {
  private query: string;

  constructor(query: string) {
    this.query = (query ?? '').trim().toLowerCase();
  }

  /**
   * Extracts words from a filename using various delimiters
   * - Spaces, hyphens, underscores, dots (except for extensions)
   * - CamelCase transitions
   * - Number transitions
   */
  private extractWords(filename: string): string[] {
    if (!filename) return [];

    // Remove file extension for word extraction, but keep it for matching
    const parts = filename.split('.');
    const extension = parts.length > 1 ? parts.pop() : '';
    const nameWithoutExt = parts.join('.');

    // Split by common delimiters
    const words: string[] = [];

    // First split by spaces, hyphens, underscores, dots
    const delimiterPattern = /[\s\-_.]+/;
    const segments = nameWithoutExt.split(delimiterPattern).filter(Boolean);

    // Then handle camelCase and number transitions within each segment
    segments.forEach((segment) => {
      // Split on camelCase transitions and number boundaries
      const camelPattern =
        /(?<=[a-z])(?=[A-Z])|(?<=[A-Za-z])(?=[0-9])|(?<=[0-9])(?=[A-Za-z])/;
      const subWords = segment.split(camelPattern).filter(Boolean);
      words.push(...subWords);
    });

    // Add extension as a word if it exists
    if (extension) {
      words.push(extension);
    }

    return words.filter((word) => word.length > 0);
  }

  /**
   * Creates a searchable string from the first letters of each word
   */
  private createSearchableString(words: string[]): string {
    return words.map((word) => word[0].toLowerCase()).join('');
  }

  /**
   * Calculates a relevance score for an acronym match
   * Higher scores indicate better matches
   */
  private calculateScore(
    searchableString: string,
    matchIndex: number,
    filename: string,
    isBasename: boolean,
  ): number {
    let score = 1;

    // Bonus for exact prefix matches (starting at beginning)
    if (matchIndex === 0) {
      score += 3;
    }

    // Bonus for consecutive matches (full query matches)
    if (this.query.length > 1) {
      score += 2;
    }

    // Bonus for matches in filename vs directory path
    if (isBasename) {
      score += 2;
    }

    // Bonus based on match density (query length / total searchable length)
    const queryLength = this.query.length;
    const totalLetters = searchableString.length;
    const density = queryLength / Math.max(totalLetters, 1);
    score += density * 2; // Up to 2 points for full density

    // Bonus for exact match length (all first letters matched)
    if (queryLength === totalLetters) {
      score += 2;
    }

    // Penalty for longer filenames (prefer shorter, more focused matches)
    const lengthPenalty = Math.max(0, filename.length - 15) * 0.02;
    score -= lengthPenalty;

    // Bonus for common file types (md files get slight preference in Obsidian context)
    if (filename.toLowerCase().endsWith('.md')) {
      score += 0.5;
    }

    // Penalty based on position of match (later matches are less relevant)
    const positionPenalty = matchIndex * 0.1;
    score -= positionPenalty;

    return Math.max(0.1, score);
  }

  /**
   * Performs acronym search on a single text string
   */
  searchText(text: string, isBasename: boolean = false): AcronymSearchResult {
    if (!this.query || !text) {
      return { match: null, score: 0 };
    }

    const words = this.extractWords(text);
    const searchableString = this.createSearchableString(words);

    // Check if query is a substring of the searchable string
    const matchIndex = searchableString.indexOf(this.query);

    if (matchIndex === -1) {
      return { match: null, score: 0 };
    }

    const score = this.calculateScore(searchableString, matchIndex, text, isBasename);

    // Create a SearchResult (Obsidian's SearchResult interface)
    // We'll create matches for each letter in the query
    const matches: [number, number][] = [];

    // Find the actual character positions in the original text
    let charIndex = 0;
    let queryIndex = 0;

    for (let i = 0; i < words.length && queryIndex < this.query.length; i++) {
      const word = words[i];
      if (i >= matchIndex && i < matchIndex + this.query.length) {
        // This word contributes to the match
        matches.push([charIndex, charIndex + 1]); // Highlight first character
        queryIndex++;
      }
      charIndex += word.length;

      // Account for delimiters in original text
      if (i < words.length - 1) {
        charIndex += 1; // Approximate delimiter length
      }
    }

    const match: SearchResult = {
      score,
      matches,
    };

    return { match, score };
  }

  /**
   * Searches through primary text and falls back to path segments if needed
   */
  searchWithFallback(
    primaryText: string,
    pathSegments?: PathSegments,
  ): AcronymSearchResult {
    // First try primary text
    let result = this.searchText(primaryText, true);

    if (!result.match && pathSegments) {
      // Try basename
      result = this.searchText(pathSegments.basename, true);

      if (!result.match) {
        // Try full path
        result = this.searchText(pathSegments.path, false);
      }
    }

    return result;
  }

  /**
   * Returns true if the searcher has a valid query
   */
  get hasSearchTerm(): boolean {
    return !!this.query.length;
  }
}
