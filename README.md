# Amaron Battery Scraper

A comprehensive Node.js application that systematically extracts battery specification data from the Amaron website using Puppeteer. The scraper navigates through all possible dropdown combinations to collect comprehensive battery data and exports it to CSV format.

## Features

- **Systematic Data Collection**: Automatically processes all possible dropdown combinations (vehicle type, brand, model, fuel type)
- **Comprehensive Data Extraction**: Captures all battery specifications including dimensions, voltage, warranty details, and terminal layout images
- **CSV Export**: Structured data output with customizable headers and formatting
- **Error Handling**: Robust error handling with retry logic and recovery strategies
- **Progress Reporting**: Real-time progress updates and detailed final summary
- **Command Line Interface**: Flexible CLI with multiple configuration options
- **Graceful Shutdown**: Proper cleanup of browser resources on interruption

## Installation

1. Clone or download the project
2. Install dependencies:
```bash
npm install
```

## Usage

### Basic Usage

```bash
# Run with default settings
node index.js

# Or use npm scripts
npm start
npm run scrape
```

### Command Line Options

```bash
# Show help
node index.js --help

# Enable verbose logging
node index.js --verbose
npm run scrape:verbose

# Specify custom output file
node index.js --output my-battery-data.csv

# Run with visible browser (for debugging)
node index.js --headless false
npm run scrape:visible

# Set custom timeout
node index.js --timeout 60000

# Combine multiple options
node index.js --verbose --output custom-data.csv --headless false
```

### Available Scripts

- `npm start` - Run the scraper with default settings
- `npm run scrape` - Same as start
- `npm run scrape:verbose` - Run with verbose logging enabled
- `npm run scrape:visible` - Run with visible browser window
- `npm test` - Run tests (when implemented)

## Output

The scraper generates a CSV file with the following columns:

- **Selection Criteria**: Vehicle Type, Brand, Model, Fuel Type
- **Battery Details**: Battery Brand, Series, Item Code, Battery Model, Dimensions
- **Electrical Specs**: Voltage, Ampere Hour, CCA (Cold Cranking Amps)
- **Warranty Info**: Total Warranty, Free Warranty, Pro-rata Warranty
- **Additional Data**: Terminal Layout Image URL, Country of Origin
- **Pricing**: Base Price, Special Discount, Total Price, Rebate (when available)

## Configuration

The scraper can be configured by modifying `src/config.js`:

- **Selectors**: CSS selectors for page elements
- **Timeouts**: Navigation and element wait timeouts
- **Browser Options**: Puppeteer launch options
- **Error Handling**: Retry logic and recovery strategies
- **Output Settings**: CSV headers and formatting options

## Error Handling

The scraper includes comprehensive error handling:

- **Network Errors**: Automatic retry for connection issues
- **Element Errors**: Fallback selectors and retry logic
- **Browser Crashes**: Automatic browser restart
- **Data Validation**: Checks for required fields and data integrity
- **Graceful Degradation**: Continues processing even if some combinations fail

## Progress Reporting

During execution, the scraper provides:

- Real-time progress updates
- Success/failure statistics
- Processing rate information
- Estimated time remaining
- Detailed final summary with statistics

## How It Works

The scraper uses a **dynamic navigation approach** to collect battery data:

1. **Discovers Available Options**: Navigates through dependent dropdowns to find all valid combinations
2. **Direct Page Navigation**: For each valid combination, navigates directly to the specific battery page URL
3. **Data Extraction**: Extracts comprehensive battery specifications from each page
4. **CSV Export**: Saves all collected data in a structured CSV format

This approach ensures that **each combination gets unique, accurate battery data** rather than duplicate information.

## Troubleshooting

### Common Issues

1. **Browser Launch Fails**
   - Ensure you have sufficient system resources
   - Try running with `--headless false` to see browser errors
   - Check if Chrome/Chromium is properly installed

2. **Network Timeouts**
   - Increase timeout with `--timeout 60000`
   - Check your internet connection
   - The website might be temporarily unavailable

3. **No Data Found for Combinations**
   - Some vehicle/brand/model/fuel combinations may not have battery data available
   - This is normal - the scraper will skip invalid combinations and continue
   - Run with `--verbose` to see detailed progress information

4. **CSV Export Issues**
   - Ensure the output directory exists and is writable
   - Check available disk space
   - Verify file permissions

### Data Quality

The scraper now correctly handles:
- ✅ **Unique battery specifications** for each combination
- ✅ **Different voltage ratings** (12V for cars, 6V for some applications, etc.)
- ✅ **Varying ampere hours** (2.5AH for motorcycles, 70AH for cars, etc.)
- ✅ **Different warranty periods** (24-60 months depending on battery type)
- ✅ **Accurate pricing and rebate information**

### Debug Mode

Run with verbose logging to get detailed information:

```bash
node index.js --verbose --headless false
```

This will:
- Show detailed progress information
- Display browser window for visual debugging
- Log all network requests and errors
- Provide step-by-step execution details

## Architecture

The application follows a modular architecture:

- **`index.js`** - Main execution script with CLI interface
- **`src/scraper.js`** - Core scraping logic and browser management
- **`src/config.js`** - Configuration settings and selectors
- **`src/csvExporter.js`** - CSV file generation and data formatting
- **`src/utils.js`** - Utility functions and helpers

## Requirements

- Node.js 14+ 
- Chrome/Chromium browser (installed automatically with Puppeteer)
- Sufficient system memory for browser operations
- Stable internet connection

## Performance

- Processing time: ~2-5 seconds per dropdown combination
- Memory usage: ~200-500MB depending on data volume
- Network usage: Minimal (only essential requests, images/CSS blocked)
- Output file size: Varies based on available battery data

## License

MIT License - see LICENSE file for details

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## Support

For issues and questions:
1. Check the troubleshooting section above
2. Run with `--verbose` flag for detailed logs
3. Review the error messages in the final summary
4. Check the browser console if running with `--headless false`