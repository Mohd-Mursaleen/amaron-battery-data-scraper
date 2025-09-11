#!/usr/bin/env node

/**
 * Main execution script for Amaron Battery Scraper
 * Orchestrates the entire scraping process with CLI interface and progress reporting
 */

const SmartUrlScraper = require('./src/smartUrlScraper');
const config = require('./src/config');
const utils = require('./src/utils');

/**
 * Display help information
 */
function displayHelp() {
  console.log(`
Amaron Battery Scraper v1.0.0

USAGE:
  node index.js [options]

OPTIONS:
  --help, -h          Show this help message
  --verbose, -v       Enable verbose logging
  --output, -o <file> Specify output CSV file name (default: battery-data.csv)
  --headless <bool>   Run browser in headless mode (default: true)
  --timeout <ms>      Set navigation timeout in milliseconds (default: 30000)

EXAMPLES:
  node index.js                           # Run with default settings
  node index.js --verbose                 # Run with verbose logging
  node index.js --output my-data.csv      # Save to custom file
  node index.js --headless false          # Run with visible browser
  node index.js --timeout 60000           # Set 60 second timeout

DESCRIPTION:
  This script scrapes battery data from the Amaron website by systematically
  navigating through all possible dropdown combinations and extracting battery
  specifications. The data is saved to a CSV file with comprehensive error
  handling and progress reporting.
  `);
}

/**
 * Parse command line arguments
 * @param {Array} args - Command line arguments
 * @returns {Object} Parsed options
 */
function parseArguments(args) {
  const options = {
    verbose: false,
    outputFile: null,
    headless: true,
    timeout: null,
    showHelp: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--help':
      case '-h':
        options.showHelp = true;
        break;
        
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
        
      case '--output':
      case '-o':
        if (i + 1 < args.length) {
          options.outputFile = args[i + 1];
          i++; // Skip next argument
        } else {
          throw new Error('--output requires a filename argument');
        }
        break;
        
      case '--headless':
        if (i + 1 < args.length) {
          const value = args[i + 1].toLowerCase();
          options.headless = value === 'true' || value === '1';
          i++; // Skip next argument
        } else {
          throw new Error('--headless requires a boolean argument (true/false)');
        }
        break;
        
      case '--timeout':
        if (i + 1 < args.length) {
          const timeout = parseInt(args[i + 1]);
          if (isNaN(timeout) || timeout <= 0) {
            throw new Error('--timeout requires a positive number in milliseconds');
          }
          options.timeout = timeout;
          i++; // Skip next argument
        } else {
          throw new Error('--timeout requires a number argument');
        }
        break;
        
      default:
        if (arg.startsWith('-')) {
          throw new Error(`Unknown option: ${arg}. Use --help for usage information.`);
        }
        break;
    }
  }

  return options;
}

/**
 * Apply configuration overrides based on command line options
 * @param {Object} options - Parsed command line options
 */
function applyConfigOverrides(options) {
  if (options.verbose) {
    config.logging.level = 'debug';
    config.logging.showProgress = true;
    utils.logProgress('Verbose logging enabled');
  }

  if (options.outputFile) {
    config.output.csvFileName = options.outputFile;
    utils.logProgress(`Output file set to: ${options.outputFile}`);
  }

  if (options.headless !== null) {
    config.browser.launchOptions.headless = options.headless;
    utils.logProgress(`Browser headless mode: ${options.headless}`);
  }

  if (options.timeout) {
    config.timeouts.navigation = options.timeout;
    utils.logProgress(`Navigation timeout set to: ${options.timeout}ms`);
  }
}

/**
 * Display startup banner with configuration information
 */
function displayStartupBanner() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                  Amaron Battery Scraper v1.0.0              ║
║                                                              ║
║  Systematically extracting battery data from Amaron website ║
╚══════════════════════════════════════════════════════════════╝
`);

  utils.logProgress('='.repeat(60));
  utils.logProgress('SCRAPING CONFIGURATION');
  utils.logProgress('='.repeat(60));
  utils.logProgress(`Target URL: ${config.baseUrl}`);
  utils.logProgress(`Output File: ${config.output.csvFileName}`);
  utils.logProgress(`Output Directory: ${config.output.outputDirectory}`);
  utils.logProgress(`Browser Headless: ${config.browser.launchOptions.headless}`);
  utils.logProgress(`Navigation Timeout: ${config.timeouts.navigation}ms`);
  utils.logProgress(`Element Wait Timeout: ${config.timeouts.elementWait}ms`);
  utils.logProgress(`Max Retries: ${config.retry.maxRetries}`);
  utils.logProgress(`Continue on Error: ${config.errorHandling.continueOnError}`);
  utils.logProgress('='.repeat(60));
}

/**
 * Display progress statistics during scraping
 * @param {Object} stats - Current statistics
 */
function displayProgressStats(stats) {
  const {
    currentCombination = 0,
    totalCombinations = 0,
    successfulCombinations = 0,
    failedCombinations = 0,
    totalBatteriesFound = 0,
    elapsedTime = 0
  } = stats;

  const percentage = totalCombinations > 0 ? ((currentCombination / totalCombinations) * 100).toFixed(1) : '0.0';
  const successRate = currentCombination > 0 ? ((successfulCombinations / currentCombination) * 100).toFixed(1) : '0.0';
  const avgBatteriesPerCombination = successfulCombinations > 0 ? (totalBatteriesFound / successfulCombinations).toFixed(1) : '0.0';
  const estimatedTimeRemaining = currentCombination > 0 && elapsedTime > 0 ? 
    Math.round(((totalCombinations - currentCombination) * elapsedTime) / currentCombination) : 0;

  console.log(`
┌─────────────────────────────────────────────────────────────┐
│                      PROGRESS REPORT                       │
├─────────────────────────────────────────────────────────────┤
│ Progress: ${currentCombination}/${totalCombinations} (${percentage}%)${' '.repeat(Math.max(0, 25 - percentage.length))} │
│ Success Rate: ${successRate}%${' '.repeat(Math.max(0, 40 - successRate.length))} │
│ Successful: ${successfulCombinations}${' '.repeat(Math.max(0, 42 - successfulCombinations.toString().length))} │
│ Failed: ${failedCombinations}${' '.repeat(Math.max(0, 46 - failedCombinations.toString().length))} │
│ Batteries Found: ${totalBatteriesFound}${' '.repeat(Math.max(0, 36 - totalBatteriesFound.toString().length))} │
│ Avg per Combination: ${avgBatteriesPerCombination}${' '.repeat(Math.max(0, 32 - avgBatteriesPerCombination.length))} │
│ Elapsed Time: ${Math.round(elapsedTime)}s${' '.repeat(Math.max(0, 38 - Math.round(elapsedTime).toString().length))} │
│ Est. Remaining: ${estimatedTimeRemaining}s${' '.repeat(Math.max(0, 35 - estimatedTimeRemaining.toString().length))} │
└─────────────────────────────────────────────────────────────┘
  `);
}

/**
 * Display final summary of scraping results
 * @param {Object} summary - Scraping summary object
 */
function displayFinalSummary(summary) {
  const {
    success,
    totalCombinations,
    successfulCombinations,
    failedCombinations,
    totalBatteriesFound,
    csvFilePath,
    duration,
    errors = []
  } = summary;

  const successRate = totalCombinations > 0 ? ((successfulCombinations / totalCombinations) * 100).toFixed(1) : '0.0';
  const avgBatteriesPerCombination = successfulCombinations > 0 ? (totalBatteriesFound / successfulCombinations).toFixed(1) : '0.0';
  const batteriesPerSecond = duration > 0 ? (totalBatteriesFound / duration).toFixed(2) : '0.00';

  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                        FINAL SUMMARY                         ║
╚══════════════════════════════════════════════════════════════╝

📊 STATISTICS:
   • Total Combinations Processed: ${totalCombinations}
   • Successful Combinations: ${successfulCombinations}
   • Failed Combinations: ${failedCombinations}
   • Success Rate: ${successRate}%
   • Total Batteries Found: ${totalBatteriesFound}
   • Average Batteries per Combination: ${avgBatteriesPerCombination}
   • Processing Rate: ${batteriesPerSecond} batteries/second

⏱️  TIMING:
   • Total Duration: ${duration} seconds
   • Average Time per Combination: ${totalCombinations > 0 ? (duration / totalCombinations).toFixed(2) : '0.00'} seconds

📁 OUTPUT:
   • CSV File: ${csvFilePath || 'Not created'}
   • File Status: ${csvFilePath ? '✅ Created successfully' : '❌ Failed to create'}

${success ? '✅ SCRAPING COMPLETED SUCCESSFULLY!' : '❌ SCRAPING COMPLETED WITH ERRORS'}
  `);

  if (errors.length > 0) {
    console.log(`
⚠️  ERRORS ENCOUNTERED:
${errors.map((error, index) => `   ${index + 1}. ${error}`).join('\n')}
    `);
  }

  if (csvFilePath) {
    console.log(`
📋 NEXT STEPS:
   • Open the CSV file: ${csvFilePath}
   • Import into Excel, Google Sheets, or your preferred data analysis tool
   • Review the data for completeness and accuracy
   • Use the terminal layout image URLs to view battery diagrams
    `);
  }

  console.log('='.repeat(60));
}

/**
 * Handle process termination gracefully
 * @param {AmaronScraper} scraper - Scraper instance to clean up
 */
function setupGracefulShutdown(scraper) {
  const cleanup = async (signal) => {
    utils.logProgress(`\nReceived ${signal}. Performing graceful shutdown...`, 'warn');
    
    try {
      if (scraper) {
        await scraper.closeBrowser();
        utils.logProgress('Browser closed successfully');
      }
    } catch (error) {
      utils.logProgress(`Error during cleanup: ${error.message}`, 'error');
    }
    
    utils.logProgress('Shutdown complete. Exiting...');
    process.exit(0);
  };

  process.on('SIGINT', () => cleanup('SIGINT'));
  process.on('SIGTERM', () => cleanup('SIGTERM'));
  process.on('SIGQUIT', () => cleanup('SIGQUIT'));
}

/**
 * Main execution function
 */
async function main() {
  let scraper = null;
  let startTime = Date.now();

  try {
    // Parse command line arguments
    const args = process.argv.slice(2);
    const options = parseArguments(args);

    // Show help if requested
    if (options.showHelp) {
      displayHelp();
      process.exit(0);
    }

    // Apply configuration overrides
    applyConfigOverrides(options);

    // Display startup information
    displayStartupBanner();

    // Initialize scraper (use smart URL scraper for efficient valid combination discovery)
    utils.logProgress('Initializing Smart URL Amaron Battery Scraper...');
    scraper = new SmartUrlScraper();

    // Setup graceful shutdown handling
    setupGracefulShutdown(scraper);

    // Start the scraping process
    utils.logProgress('Starting scraping process...');
    const summary = await scraper.scrape();

    // Display final summary
    displayFinalSummary(summary);

    // Exit with appropriate code
    process.exit(summary.success ? 0 : 1);

  } catch (error) {
    utils.logProgress(`Fatal error: ${error.message}`, 'error');
    
    // Display error summary
    const errorSummary = {
      success: false,
      totalCombinations: 0,
      successfulCombinations: 0,
      failedCombinations: 0,
      totalBatteriesFound: 0,
      csvFilePath: null,
      duration: Math.round((Date.now() - startTime) / 1000),
      errors: [error.message]
    };
    
    displayFinalSummary(errorSummary);

    // Cleanup
    if (scraper) {
      try {
        await scraper.closeBrowser();
      } catch (cleanupError) {
        utils.logProgress(`Cleanup error: ${cleanupError.message}`, 'error');
      }
    }

    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  utils.logProgress(`Unhandled Rejection at: ${promise}, reason: ${reason}`, 'error');
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  utils.logProgress(`Uncaught Exception: ${error.message}`, 'error');
  process.exit(1);
});

// Run the main function if this script is executed directly
if (require.main === module) {
  main();
}

module.exports = { main, parseArguments, displayFinalSummary };