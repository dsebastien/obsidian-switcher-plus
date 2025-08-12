import { AcronymSearcher } from '../acronymSearcher';

describe('AcronymSearcher', () => {
  describe('basic functionality', () => {
    it('should match simple initials', () => {
      const searcher = new AcronymSearcher('mfc');
      const result = searcher.searchText('MyFirstComponent.jsx');

      expect(result.match).not.toBeNull();
      expect(result.score).toBeGreaterThan(0);
    });

    it('should match with hyphens', () => {
      const searcher = new AcronymSearcher('mfc');
      const result = searcher.searchText('my-first-class.py');

      expect(result.match).not.toBeNull();
      expect(result.score).toBeGreaterThan(0);
    });

    it('should match with underscores', () => {
      const searcher = new AcronymSearcher('gts');
      const result = searcher.searchText('get_the_score.txt');

      expect(result.match).not.toBeNull();
      expect(result.score).toBeGreaterThan(0);
    });

    it('should match camelCase transitions', () => {
      const searcher = new AcronymSearcher('gus');
      const result = searcher.searchText('getUserStatus.js');

      expect(result.match).not.toBeNull();
      expect(result.score).toBeGreaterThan(0);
    });

    it('should not match when letters are not at word boundaries', () => {
      const searcher = new AcronymSearcher('abc');
      const result = searcher.searchText('xaybzc.txt'); // letters not at start of words

      expect(result.match).toBeNull();
    });

    it('should handle case insensitive matching', () => {
      const searcher = new AcronymSearcher('MFC');
      const result = searcher.searchText('myFirstComponent.jsx');

      expect(result.match).not.toBeNull();
      expect(result.score).toBeGreaterThan(0);
    });

    it('should match with numbers', () => {
      const searcher = new AcronymSearcher('f1t');
      const result = searcher.searchText('file123test.md');

      expect(result.match).not.toBeNull();
      expect(result.score).toBeGreaterThan(0);
    });

    it('should return null for empty query', () => {
      const searcher = new AcronymSearcher('');
      const result = searcher.searchText('anyfile.txt');

      expect(result.match).toBeNull();
      expect(result.score).toBe(0);
    });

    it('should return null for empty text', () => {
      const searcher = new AcronymSearcher('abc');
      const result = searcher.searchText('');

      expect(result.match).toBeNull();
      expect(result.score).toBe(0);
    });
  });

  describe('scoring', () => {
    it('should give higher scores to prefix matches', () => {
      const searcher = new AcronymSearcher('abc');

      const prefixResult = searcher.searchText('apple-banana-cherry.txt');
      const middleResult = searcher.searchText('zebra-apple-banana-cherry.txt');

      expect(prefixResult.score).toBeGreaterThan(middleResult.score);
    });

    it('should give higher scores to basename matches', () => {
      const searcher = new AcronymSearcher('abc');

      const basenameResult = searcher.searchText('apple-banana-cherry.txt', true);
      const pathResult = searcher.searchText('apple-banana-cherry.txt', false);

      expect(basenameResult.score).toBeGreaterThan(pathResult.score);
    });
  });

  describe('hasSearchTerm', () => {
    it('should return true for non-empty query', () => {
      const searcher = new AcronymSearcher('abc');
      expect(searcher.hasSearchTerm).toBe(true);
    });

    it('should return false for empty query', () => {
      const searcher = new AcronymSearcher('');
      expect(searcher.hasSearchTerm).toBe(false);
    });

    it('should return false for whitespace-only query', () => {
      const searcher = new AcronymSearcher('   ');
      expect(searcher.hasSearchTerm).toBe(false);
    });
  });
});
