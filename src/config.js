/**
 * Configuration module for Amaron Battery Scraper
 * Contains all CSS selectors, timeout values, URLs, and CSV settings
 */

const config = {
  // Base URL for the Amaron battery selection page
  baseUrl: 'https://www.amaron.com/battery/passengers/ashok-leyland/stile/diesel',

  // CSS selectors for page elements
  selectors: {
    // Dropdown selectors - based on actual page inspection
    vehicleTypeDropdown: '#edit-select-vehicle, select[name="select-vehicle"]',
    brandDropdown: '#edit-vehicle-make, select[name="vehicle-make"]',
    modelDropdown: '#edit-model, select[name="model"]',
    fuelTypeDropdown: '#edit-fuel, select[name="fuel"]',
    
    // Action buttons
    findButton: 'button[type="submit"]',
    searchButton: '.search-button',
    
    // Results and data extraction
    resultsTable: '.battery-results-table',
    resultsContainer: '.results-container',
    batterySpecs: '.battery-specifications',
    batteryCard: '.battery-card',
    
    // Specific data fields
    batteryBrand: '.battery-brand',
    batterySeries: '.battery-series',
    itemCode: '.item-code',
    batteryModel: '.battery-model',
    dimensions: '.dimensions',
    voltage: '.voltage',
    ampereHour: '.ampere-hour',
    cca: '.cca',
    totalWarranty: '.total-warranty',
    freeWarranty: '.free-warranty',
    proRataWarranty: '.pro-rata-warranty',
    terminalImage: '.terminal-layout img',
    countryOfOrigin: '.country-origin',
    
    // Pricing elements
    basePrice: '.base-price',
    specialDiscount: '.special-discount',
    totalPrice: '.total-price',
    rebate: '.rebate',
    
    // Loading and status indicators
    loadingSpinner: '.loading-spinner',
    noResults: '.no-results',
    errorMessage: '.error-message'
  },

  // Timeout configurations (in milliseconds)
  timeouts: {
    // Page navigation timeout
    navigation: 30000,
    
    // Element wait timeout
    elementWait: 10000,
    
    // Delay after dropdown selection to allow content loading
    loadDelay: 2000,
    
    // Delay between dropdown selections
    selectionDelay: 1500,
    
    // Retry timeout for failed operations
    retryDelay: 3000,
    
    // Maximum wait for AJAX requests
    ajaxWait: 15000
  },

  // Output file configurations
  output: {
    // CSV file name and path
    csvFileName: 'battery-data.csv',
    outputDirectory: './output',
    
    // CSV headers in order
    csvHeaders: [
      'Vehicle Type',
      'Brand', 
      'Model',
      'Fuel Type',
      'Battery Brand',
      'Series',
      'Item Code',
      'Battery Model',
      'Dimensions',
      'Voltage',
      'Ampere Hour',
      'CCA',
      'Total Warranty',
      'Free Warranty',
      'Pro-rata Warranty',
      'Terminal Layout Image URL',
      'Country of Origin',
      'Base Price',
      'Special Discount',
      'Total Price',
      'Rebate'
    ],
    
    // CSV formatting options
    csvOptions: {
      delimiter: ',',
      quote: '"',
      escape: '"',
      header: true
    }
  },

  // Browser configuration
  browser: {
    // Puppeteer launch options
    launchOptions: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    },
    
    // Page configuration
    pageOptions: {
      viewport: {
        width: 1366,
        height: 768
      },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
  },

  // Retry and error handling configuration
  retry: {
    // Maximum number of retries for failed operations
    maxRetries: 3,
    
    // Retry delay multiplier for exponential backoff
    backoffMultiplier: 2,
    
    // Operations that should be retried
    retryableOperations: [
      'navigation',
      'elementWait',
      'dropdownSelection',
      'dataExtraction',
      'browserInit',
      'csvWrite',
      'networkRequest'
    ],
    
    // Network error patterns that should trigger retries
    retryableNetworkErrors: [
      'ECONNRESET',
      'ENOTFOUND', 
      'ECONNREFUSED',
      'ETIMEDOUT',
      'EPIPE',
      'EHOSTUNREACH',
      'EAI_AGAIN',
      'net::ERR_NETWORK_CHANGED',
      'net::ERR_CONNECTION_RESET',
      'net::ERR_CONNECTION_REFUSED',
      'net::ERR_NAME_NOT_RESOLVED',
      'net::ERR_INTERNET_DISCONNECTED',
      'Navigation timeout',
      'Protocol error'
    ],
    
    // Element error patterns that should trigger retries
    retryableElementErrors: [
      'Element not found',
      'waiting for selector',
      'Node is detached',
      'Element is not clickable',
      'Element not visible',
      'Execution context was destroyed',
      'Cannot find context'
    ]
  },

  // Error handling configuration
  errorHandling: {
    // Maximum consecutive errors before aborting
    maxConsecutiveErrors: 10,
    
    // Whether to continue processing after errors
    continueOnError: true,
    
    // Whether to save partial results on error
    savePartialResults: true,
    
    // Error recovery strategies
    recoveryStrategies: {
      // Refresh page after N consecutive errors
      pageRefreshThreshold: 5,
      
      // Restart browser after N consecutive errors
      browserRestartThreshold: 15,
      
      // Skip combination after N consecutive errors
      skipCombinationThreshold: 3
    },
    
    // Error reporting configuration
    reporting: {
      // Log detailed error information
      detailedLogging: true,
      
      // Include stack traces in error logs
      includeStackTrace: false,
      
      // Save error logs to file
      saveErrorLogs: false,
      
      // Error log file path
      errorLogFile: './output/error-log.txt'
    }
  },

  // Logging configuration
  logging: {
    // Log levels: 'error', 'warn', 'info', 'debug'
    level: 'info',
    
    // Enable progress logging
    showProgress: true,
    
    // Log file path (optional)
    logFile: null,
    
    // Enable timestamp in logs
    timestamp: true
  },

  // Data validation rules
  validation: {
    // Required fields that must be present
    requiredFields: [
      'vehicleType',
      'brand',
      'model',
      'fuelType'
    ],
    
    // Fields that should be numeric
    numericFields: [
      'voltage',
      'ampereHour',
      'cca',
      'totalWarranty',
      'freeWarranty',
      'proRataWarranty',
      'basePrice',
      'totalPrice'
    ],
    
    // Maximum length for text fields
    maxFieldLength: 500
  }
};

module.exports = config;