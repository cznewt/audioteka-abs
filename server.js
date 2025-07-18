const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

function cleanCoverUrl(url) {
  if (url) {
    return url.split('?')[0];
  }
  return url;
}

function parseDuration(durationStr) {
  if (!durationStr) return undefined;

  let hours = 0;
  let minutes = 0;

  // Use the regex provided by the user, REMOVED 'g' and 'm' flags
  const durationRegex = /^(?:(\d+)\s+[^\d\s]+)?\s*(?:(\d+)\s+[^\d\s]+)$/; 
  // No need to reset lastIndex without the 'g' flag
  const matches = durationStr.match(durationRegex);

  // Check if the regex matched successfully
  // Without 'g', matches will be null if no match, or an array like:
  // [fullMatch, captureGroup1, captureGroup2, ...]
  if (matches) { 
    // matches[1] is the hours capture group (optional)
    // matches[2] is the minutes capture group (mandatory part of the pattern)
    
    if (matches[1]) { // Check if hours group was captured
      hours = parseInt(matches[1], 10);
    }
    // matches[2] should exist if matches is not null, based on the regex structure
    if (matches[2]) { 
      minutes = parseInt(matches[2], 10);
    }
  } else {
      // Log if the regex failed to match
      if (durationStr.trim()) {
        console.warn(`Could not parse duration string using provided regex: "${durationStr}"`);
      }
      // Consider if a fallback or different handling is needed for strings
      // that don't match (e.g., only hours "1 hodina")
      return undefined; // Return undefined if parsing fails
  }

  // Ensure we have valid numbers, default to 0 if parseInt resulted in NaN
  if (isNaN(hours)) hours = 0;
  if (isNaN(minutes)) minutes = 0;

  // Return total duration in minutes
  const durationInMinutes = (hours * 60) + minutes;
  // Keep the log to confirm output
  console.log(`Parsed duration in minutes for "${durationStr}": ${durationInMinutes}`);
  return durationInMinutes;
}

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());

// Middleware to check for AUTHORIZATION header
app.use((req, res, next) => {
  const apiKey = req.headers['authorization'];
  if (!apiKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  // part to validate API
  next();
});

const language = process.env.LANGUAGE || 'pl';  // Default to Polish if not specified
const addAudiotekaLinkToDescription = (process.env.ADD_AUDIOTEKA_LINK_TO_DESCRIPTION || 'true').toLowerCase() === 'true';

class AudiotekaProvider {
  constructor() {
    this.id = 'audioteka';
    this.name = 'Audioteka';
    this.baseUrl = 'https://audioteka.com';
    this.searchUrl = language === 'cz' ? 'https://audioteka.com/cz/vyhledavani' : 'https://audioteka.com/pl/szukaj';
  }

  async searchBooks(query, author = '') {
    try {
      console.log(`Searching for: "${query}" by "${author}"`);
      const searchUrl = `${this.searchUrl}?phrase=${encodeURIComponent(query)}`;
      
      const response = await axios.get(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept-Language': language === 'cz' ? 'cs-CZ' : 'pl-PL'
        }
      });
      const $ = cheerio.load(response.data);

      console.log('Search URL:', searchUrl);

      const matches = [];
      const $books = $('.adtk-item.teaser_teaser__FDajW');
      console.log('Number of books found:', $books.length);

      $books.each((index, element) => {
        const $book = $(element);
        
        const title = $book.find('.teaser_title__hDeCG').text().trim();
        const bookUrl = this.baseUrl + $book.find('.teaser_link__fxVFQ').attr('href');
        const authors = [$book.find('.teaser_author__LWTRi').text().trim()];
        const cover = cleanCoverUrl($book.find('.teaser_coverImage__YMrBt').attr('src'));
        const rating = parseFloat($book.find('.teaser-footer_rating__TeVOA').text().trim()) || null;

        const id = $book.attr('data-item-id') || bookUrl.split('/').pop();

        if (title && bookUrl && authors.length > 0) {
          matches.push({
            id,
            title,
            authors,
            url: bookUrl,
            cover,
            rating,
            source: {
              id: this.id,
              description: this.name,
              link: this.baseUrl,
            },
          });
        }
      });

      const fullMetadata = await Promise.all(matches.map(match => this.getFullMetadata(match)));
      return { matches: fullMetadata };
    } catch (error) {
      console.error('Error searching books:', error.message, error.stack);
      return { matches: [] };
    }
  }

  async getFullMetadata(match) {
    try {
      console.log(`Fetching full metadata for: ${match.title}`);
      const response = await axios.get(match.url);
      const $ = cheerio.load(response.data);

      // Get narrator from the "Głosy" row in the details table
      const narrators = language === 'cz' 
      ? $('tr:contains("Interpret") td:last-child a')
        .map((i, el) => $(el).text().trim())
        .get()
        .join(', ')
      : $('tr:contains("Głosy") td:last-child a')
        .map((i, el) => $(el).text().trim())
        .get()
        .join(', ');
  
      // Get duration from the "Długość"/"Délka" row - target the TD directly
      const durationStr = language === 'cz'
        ? $('tr:contains("Délka") td:last-child').text().trim() // Get text directly from the TD
        : $('tr:contains("Długość") td:last-child').text().trim(); // Get text directly from the TD

      // Add logging to see the extracted string
      console.log(`Extracted duration string for ${match.title}: "${durationStr}"`); 

      const durationInMinutes = parseDuration(durationStr); // Function now returns minutes

      // Get publisher from the "Wydawca" row
      const publisher = language === 'cz'  
        ? $('tr:contains("Vydavatel") td:last-child a').text().trim()
        : $('tr:contains("Wydawca") td:last-child a').text().trim();

      // Get type from the "Typ" row
      const type = language === 'cz' 
        ? $('tr:contains("Typ") td:last-child').text().trim()
        : $('tr:contains("Typ") td:last-child').text().trim()

      // Get categories/genres
      const genres = language === 'cz'
        ? $('tr:contains("Kategorie") td:last-child a')
            .map((i, el) => $(el).text().trim())
            .get(): $('tr:contains("Kategoria") td:last-child a')
            .map((i, el) => $(el).text().trim())
            .get();

      // Get series information
      const series = $('.collections_list__09q3I li a')
        .map((i, el) => $(el).text().trim())
        .get();

      // Get rating
      const rating = parseFloat($('.StarIcon__Label-sc-6cf2a375-2').text().trim()) || null;
      
      // Get description with HTML
      const descriptionHtml = $('.description_description__6gcfq').html();
      
      // Basic sanitization (you might want to use a proper HTML sanitizer library for production)
      const sanitizedDescription = descriptionHtml
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');

      let description = sanitizedDescription;
      if (addAudiotekaLinkToDescription) {
        // Create the HTML link
        const audioTekaLink = `<a href="${match.url}">Audioteka link</a>`;
        // Combine the link and the description
        description = `${audioTekaLink}<br><br>${sanitizedDescription}`;
        console.log(`Audioteka link will be added to the description for ${match.title}`);
      }

      // Get main cover image and clean the URL
      const cover = cleanCoverUrl($('.product-top_cover__Pth8B').attr('src') || match.cover);

      const languages = language === 'cz' 
      ? ['czech'] 
      : ['polish']

      const fullMetadata = {
        ...match,
        cover,
        narrator: narrators,
        duration: durationInMinutes, // Assign the parsed minutes value
        publisher,
        description,
        type,
        genres,
        series: [],
        tags: series,
        rating,
        languages, 
        identifiers: {
          audioteka: match.id,
        },
      };

      console.log(`Full metadata for ${match.title}:`, JSON.stringify(fullMetadata, null, 2));
      return fullMetadata;
    } catch (error) {
      console.error(`Error fetching full metadata for ${match.title}:`, error.message, error.stack);
      // Return basic metadata if full metadata fetch fails
      return match;
    }
  }
}

const provider = new AudiotekaProvider();

app.get('/search', async (req, res) => {
  try {
    console.log('Received search request:', req.query);
    const query = req.query.query;
    const author = req.query.author;

    if (!query) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }

    const results = await provider.searchBooks(query, author);
    
    // Format the response according to the OpenAPI specification
    const formattedResults = {
      matches: results.matches.map(book => ({
        title: book.title,
        subtitle: book.subtitle || undefined,
        author: book.authors.join(', '),
        narrator: book.narrator || undefined,
        publisher: book.publisher || undefined,
        publishedYear: book.publishedDate ? new Date(book.publishedDate).getFullYear().toString() : undefined,
        description: book.description || undefined,
        cover: book.cover || undefined,
        isbn: book.identifiers?.isbn || undefined,
        asin: book.identifiers?.asin || undefined,
        genres: book.genres || undefined,
        tags: book.tags || undefined,
        series: book.series ? book.series.map(seriesName => ({
          series: seriesName,
          sequence: undefined // Audioteka doesn't provide sequence numbers
        })) : undefined,
        language: book.languages && book.languages.length > 0 ? book.languages[0] : undefined,
        duration: book.duration // This will now be the value in minutes from getFullMetadata
      }))
    };

    console.log('Sending response:', JSON.stringify(formattedResults, null, 2));
    res.json(formattedResults);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(port, () => {
  console.log(`Audioteka provider listening on port ${port}, language: ${language}, add link to description: ${addAudiotekaLinkToDescription}`);
});
