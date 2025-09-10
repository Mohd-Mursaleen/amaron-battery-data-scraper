/**
 * Utility functions for the Amaron Battery Scraper
 * Provides helper functions for element waiting, interaction, and data processing
 */

/**
 * Waits for an element to be available on the page with enhanced error handling
 * @param {Page} page - Puppeteer page instance
 * @param {string} selector - CSS selector to wait for
 * @param {number} timeout - Timeout in milliseconds (default: 10000)
 * @param {Object} options - Additional options for waiting
 * @returns {Promise<ElementHandle>} - The found element
 */
async function waitForElement(page, selector, timeout = 10000, options = {}) {
  const maxRetries = options.retries || 2;
  let lastError = null;

  // Validate inputs
  if (!page) {
    throw new Error('Page instance is required for waitForElement');
  }
  if (!selector || typeof selector !== 'string') {
    throw new Error('Valid CSS selector is required for waitForElement');
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logProgress(`Waiting for element: ${selector} (attempt ${attempt}/${maxRetries}, timeout: ${timeout}ms)`);
      
      // Check if page is still valid
      if (page.isClosed()) {
        throw new Error('Page is closed, cannot wait for element');
      }

      // Wait for selector with comprehensive options
      await page.waitForSelector(selector, { 
        timeout, 
        visible: options.visible !== false, // Default to true
        hidden: options.hidden || false
      });
      
      // Get the element
      const element = await page.$(selector);
      if (!element) {
        throw new Error(`Element found by waitForSelector but not by page.$: ${selector}`);
      }

      logProgress(`Element found successfully: ${selector}`);
      return element;
      
    } catch (error) {
      lastError = error;
      logProgress(`Element wait attempt ${attempt} failed for ${selector}: ${error.message}`, 'warn');
      
      // Check for specific error types
      if (error.message.includes('Navigation timeout')) {
        throw new Error(`Navigation timeout while waiting for element: ${selector}`);
      }
      
      if (error.message.includes('Page crashed')) {
        throw new Error(`Page crashed while waiting for element: ${selector}`);
      }

      if (attempt === maxRetries) {
        // Try alternative selectors if provided
        if (selector.includes(',')) {
          const selectors = selector.split(',').map(s => s.trim());
          logProgress(`Trying alternative selectors for: ${selector}`, 'warn');
          
          for (const altSelector of selectors) {
            try {
              await page.waitForSelector(altSelector, { timeout: timeout / 2, visible: true });
              const element = await page.$(altSelector);
              if (element) {
                logProgress(`Found element with alternative selector: ${altSelector}`);
                return element;
              }
            } catch (altError) {
              continue;
            }
          }
        }
        
        throw new Error(`Element not found after ${maxRetries} attempts: ${selector} (timeout: ${timeout}ms). Last error: ${lastError.message}`);
      }
      
      // Wait before retry
      await delay(1000 * attempt);
    }
  }
}

/**
 * Safely clicks an element with comprehensive error handling and retry logic
 * @param {Page} page - Puppeteer page instance
 * @param {string} selector - CSS selector of element to click
 * @param {number} retries - Number of retry attempts (default: 3)
 * @param {Object} options - Additional click options
 * @returns {Promise<boolean>} - Success status
 */
async function safeClick(page, selector, retries = 3, options = {}) {
  // Validate inputs
  if (!page) {
    logProgress('Page instance is required for safeClick', 'error');
    return false;
  }
  if (!selector || typeof selector !== 'string') {
    logProgress('Valid CSS selector is required for safeClick', 'error');
    return false;
  }

  let lastError = null;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      logProgress(`Attempting to click element: ${selector} (attempt ${attempt}/${retries})`);
      
      // Check if page is still valid
      if (page.isClosed()) {
        throw new Error('Page is closed, cannot click element');
      }

      // Wait for element to be available and clickable
      const element = await waitForElement(page, selector, options.timeout || 10000, { retries: 1 });
      
      // Check if element is actually clickable
      const isClickable = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) return false;
        
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && 
               style.visibility !== 'hidden' && 
               !el.disabled &&
               style.pointerEvents !== 'none';
      }, selector);

      if (!isClickable) {
        throw new Error(`Element is not clickable: ${selector}`);
      }

      // Scroll element into view if needed
      try {
        await page.evaluate((sel) => {
          const el = document.querySelector(sel);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, selector);
        await delay(500); // Wait for scroll to complete
      } catch (scrollError) {
        logProgress(`Warning: Could not scroll element into view: ${scrollError.message}`, 'warn');
      }

      // Perform the click with error handling
      try {
        await page.click(selector, options.clickOptions || {});
      } catch (clickError) {
        // Try alternative click methods
        logProgress(`Standard click failed, trying alternative methods: ${clickError.message}`, 'warn');
        
        // Try clicking with JavaScript
        await page.evaluate((sel) => {
          const el = document.querySelector(sel);
          if (el && typeof el.click === 'function') {
            el.click();
          } else {
            throw new Error('Element does not have click method');
          }
        }, selector);
      }

      // Wait after click to allow for any resulting page changes
      await delay(options.postClickDelay || 500);
      
      logProgress(`Successfully clicked element: ${selector}`);
      return true;
      
    } catch (error) {
      lastError = error;
      logProgress(`Click attempt ${attempt} failed for ${selector}: ${error.message}`, 'warn');
      
      // Check for specific error types that shouldn't be retried
      if (error.message.includes('Page crashed') || 
          error.message.includes('Page is closed') ||
          error.message.includes('Navigation timeout')) {
        logProgress(`Non-retryable error encountered: ${error.message}`, 'error');
        return false;
      }
      
      if (attempt === retries) {
        logProgress(`Failed to click element after ${retries} attempts: ${selector}. Last error: ${lastError.message}`, 'error');
        return false;
      }
      
      // Wait before retry with exponential backoff
      const backoffDelay = (options.retryDelay || 1000) * Math.pow(2, attempt - 1);
      logProgress(`Retrying click in ${backoffDelay}ms...`, 'warn');
      await delay(backoffDelay);
    }
  }
  
  return false;
}

/**
 * Safely extracts text from an element with comprehensive error handling
 * @param {Page} page - Puppeteer page instance
 * @param {string} selector - CSS selector of element
 * @param {string} defaultValue - Default value if extraction fails
 * @param {Object} options - Additional extraction options
 * @returns {Promise<string>} - Extracted text or default value
 */
async function extractText(page, selector, defaultValue = '', options = {}) {
  const maxRetries = options.retries || 2;
  let lastError = null;

  // Validate inputs
  if (!page) {
    logProgress('Page instance is required for extractText', 'error');
    return defaultValue;
  }
  if (!selector || typeof selector !== 'string') {
    logProgress('Valid CSS selector is required for extractText', 'error');
    return defaultValue;
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Check if page is still valid
      if (page.isClosed()) {
        throw new Error('Page is closed, cannot extract text');
      }

      // Try to find the element with timeout
      const element = await page.$(selector);
      if (!element) {
        // Try alternative selectors if provided
        if (selector.includes(',')) {
          const selectors = selector.split(',').map(s => s.trim());
          for (const altSelector of selectors) {
            const altElement = await page.$(altSelector);
            if (altElement) {
              const text = await page.evaluate(el => {
                if (!el) return '';
                return (el.textContent || el.innerText || '').trim();
              }, altElement);
              
              if (text) {
                logProgress(`Text extracted with alternative selector ${altSelector}: "${text.substring(0, 50)}..."`);
                return options.sanitize !== false ? sanitizeText(text) : text;
              }
            }
          }
        }
        
        logProgress(`Element not found for text extraction: ${selector}`, 'warn');
        return defaultValue;
      }
      
      // Extract text with multiple fallback methods
      const text = await page.evaluate(el => {
        if (!el) return '';
        
        // Try different text extraction methods
        let extractedText = '';
        
        if (el.textContent) {
          extractedText = el.textContent.trim();
        } else if (el.innerText) {
          extractedText = el.innerText.trim();
        } else if (el.innerHTML) {
          // Strip HTML tags as fallback
          extractedText = el.innerHTML.replace(/<[^>]*>/g, '').trim();
        } else if (el.value !== undefined) {
          // For input elements
          extractedText = el.value.trim();
        }
        
        return extractedText;
      }, element);
      
      if (text) {
        const finalText = options.sanitize !== false ? sanitizeText(text) : text;
        logProgress(`Text extracted successfully from ${selector}: "${finalText.substring(0, 50)}${finalText.length > 50 ? '...' : ''}"`);
        return finalText;
      } else {
        logProgress(`Element found but no text content: ${selector}`, 'warn');
        return defaultValue;
      }
      
    } catch (error) {
      lastError = error;
      logProgress(`Text extraction attempt ${attempt} failed for ${selector}: ${error.message}`, 'warn');
      
      if (attempt === maxRetries) {
        logProgress(`Failed to extract text after ${maxRetries} attempts: ${selector}. Last error: ${lastError.message}`, 'error');
        return defaultValue;
      }
      
      // Wait before retry
      await delay(500 * attempt);
    }
  }
  
  return defaultValue;
}

/**
 * Sanitizes extracted text by removing excessive whitespace and special characters
 * @param {string} text - Text to sanitize
 * @returns {string} - Sanitized text
 */
function sanitizeText(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }
  
  return text
    .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
    .replace(/[\r\n\t]/g, ' ') // Replace line breaks and tabs with space
    .replace(/[^\x20-\x7E\u00A0-\u024F\u1E00-\u1EFF]/g, '') // Remove non-printable characters
    .trim();
}

/**
 * Extracts attribute value from an element
 * @param {Page} page - Puppeteer page instance
 * @param {string} selector - CSS selector of element
 * @param {string} attribute - Attribute name to extract
 * @param {string} defaultValue - Default value if extraction fails
 * @returns {Promise<string>} - Extracted attribute value or default value
 */
async function extractAttribute(page, selector, attribute, defaultValue = '') {
  try {
    const element = await page.$(selector);
    if (!element) {
      return defaultValue;
    }
    
    const value = await page.evaluate((el, attr) => el.getAttribute(attr), element, attribute);
    return value || defaultValue;
  } catch (error) {
    console.warn(`Attribute extraction failed for ${selector}[${attribute}]: ${error.message}`);
    return defaultValue;
  }
}

/**
 * Adds a delay/pause in execution
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generates all possible combinations from dropdown options
 * @param {Object} dropdownOptions - Object containing arrays of options for each dropdown
 * @returns {Array<Object>} - Array of all possible combinations
 */
function generateCombinations(dropdownOptions) {
  const { vehicleTypes = [], brands = [], models = [], fuelTypes = [] } = dropdownOptions;
  
  const combinations = [];
  
  for (const vehicleType of vehicleTypes) {
    for (const brand of brands) {
      for (const model of models) {
        for (const fuelType of fuelTypes) {
          combinations.push({
            vehicleType,
            brand,
            model,
            fuelType
          });
        }
      }
    }
  }
  
  logProgress(`Generated ${combinations.length} dropdown combinations`);
  return combinations;
}

/**
 * Logs progress with timestamp and formatting
 * @param {string} message - Progress message to log
 * @param {string} level - Log level (info, warn, error)
 */
function logProgress(message, level = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
  
  switch (level) {
    case 'warn':
      console.warn(`${prefix} ${message}`);
      break;
    case 'error':
      console.error(`${prefix} ${message}`);
      break;
    default:
      console.log(`${prefix} ${message}`);
  }
}

/**
 * Logs detailed progress for combination processing
 * @param {number} current - Current combination index
 * @param {number} total - Total number of combinations
 * @param {Object} combination - Current combination being processed
 */
function logCombinationProgress(current, total, combination) {
  const percentage = ((current / total) * 100).toFixed(1);
  const { vehicleType, brand, model, fuelType } = combination;
  
  logProgress(
    `Processing combination ${current}/${total} (${percentage}%) - ` +
    `${vehicleType} | ${brand} | ${model} | ${fuelType}`
  );
}

/**
 * Waits for page to be in a stable state (no pending network requests)
 * @param {Page} page - Puppeteer page instance
 * @param {number} timeout - Maximum wait time in milliseconds
 * @returns {Promise<void>}
 */
async function waitForPageStable(page, timeout = 5000) {
  try {
    await page.waitForLoadState('networkidle', { timeout });
  } catch (error) {
    // Fallback to simple delay if networkidle is not available
    await delay(2000);
  }
}

/**
 * Safely selects an option from a dropdown
 * @param {Page} page - Puppeteer page instance
 * @param {string} selector - CSS selector of the dropdown
 * @param {string} value - Value to select
 * @returns {Promise<boolean>} - Success status
 */
async function selectDropdownOption(page, selector, value) {
  try {
    await waitForElement(page, selector);
    await page.select(selector, value);
    await delay(500); // Allow time for any dynamic updates
    return true;
  } catch (error) {
    console.warn(`Failed to select option "${value}" from dropdown ${selector}: ${error.message}`);
    return false;
  }
}

/**
 * Gets all available options from a dropdown
 * @param {Page} page - Puppeteer page instance
 * @param {string} selector - CSS selector of the dropdown
 * @returns {Promise<Array<{value: string, text: string}>>} - Array of option objects
 */
async function getDropdownOptions(page, selector) {
  try {
    await waitForElement(page, selector);
    
    const options = await page.evaluate((sel) => {
      const dropdown = document.querySelector(sel);
      if (!dropdown) return [];
      
      return Array.from(dropdown.options)
        .filter(option => option.value && option.value !== '')
        .map(option => ({
          value: option.value,
          text: option.textContent.trim()
        }));
    }, selector);
    
    return options;
  } catch (error) {
    console.warn(`Failed to get dropdown options for ${selector}: ${error.message}`);
    return [];
  }
}

/**
 * Validates that required elements exist on the page
 * @param {Page} page - Puppeteer page instance
 * @param {Array<string>} selectors - Array of CSS selectors to validate
 * @returns {Promise<boolean>} - True if all elements exist
 */
async function validatePageElements(page, selectors) {
  for (const selector of selectors) {
    try {
      await waitForElement(page, selector, 5000);
    } catch (error) {
      logProgress(`Required element not found: ${selector}`, 'error');
      return false;
    }
  }
  return true;
}

/**
 * Executes a function with retry logic and comprehensive error handling
 * @param {Function} fn - Function to execute
 * @param {Object} options - Retry options
 * @returns {Promise<any>} - Function result
 */
async function executeWithRetry(fn, options = {}) {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    backoffMultiplier = 2,
    retryCondition = () => true,
    operationName = 'operation'
  } = options;

  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logProgress(`Executing ${operationName} (attempt ${attempt}/${maxRetries})`);
      const result = await fn();
      logProgress(`${operationName} completed successfully`);
      return result;
    } catch (error) {
      lastError = error;
      logProgress(`${operationName} attempt ${attempt} failed: ${error.message}`, 'warn');
      
      // Check if error should be retried
      if (!retryCondition(error) || attempt === maxRetries) {
        if (attempt === maxRetries) {
          throw new Error(`${operationName} failed after ${maxRetries} attempts. Last error: ${lastError.message}`);
        } else {
          throw error;
        }
      }
      
      // Calculate delay with exponential backoff
      const currentDelay = retryDelay * Math.pow(backoffMultiplier, attempt - 1);
      logProgress(`Retrying ${operationName} in ${currentDelay}ms...`, 'warn');
      await delay(currentDelay);
    }
  }
}

/**
 * Handles network-related errors with appropriate retry logic
 * @param {Error} error - The error to check
 * @returns {boolean} - Whether the error should be retried
 */
function isRetryableNetworkError(error) {
  const retryableErrors = [
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
    'Timeout',
    'Protocol error'
  ];

  const errorMessage = error.message || '';
  return retryableErrors.some(retryableError => 
    errorMessage.includes(retryableError)
  );
}

/**
 * Handles element selection errors with appropriate retry logic
 * @param {Error} error - The error to check
 * @returns {boolean} - Whether the error should be retried
 */
function isRetryableElementError(error) {
  const retryableErrors = [
    'Element not found',
    'waiting for selector',
    'Node is detached',
    'Element is not clickable',
    'Element not visible',
    'Execution context was destroyed'
  ];

  const errorMessage = error.message || '';
  return retryableErrors.some(retryableError => 
    errorMessage.includes(retryableError)
  );
}

/**
 * Creates a timeout wrapper for promises
 * @param {Promise} promise - Promise to wrap
 * @param {number} timeout - Timeout in milliseconds
 * @param {string} operationName - Name of operation for error messages
 * @returns {Promise} - Promise that rejects on timeout
 */
function withTimeout(promise, timeout, operationName = 'operation') {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`${operationName} timed out after ${timeout}ms`));
      }, timeout);
    })
  ]);
}

/**
 * Validates page state and throws descriptive errors
 * @param {Page} page - Puppeteer page instance
 * @param {string} operation - Current operation name
 */
async function validatePageState(page, operation = 'operation') {
  if (!page) {
    throw new Error(`Page instance is null for ${operation}`);
  }
  
  if (page.isClosed()) {
    throw new Error(`Page is closed, cannot perform ${operation}`);
  }
  
  try {
    // Check if page is responsive
    await page.evaluate(() => document.readyState);
  } catch (error) {
    throw new Error(`Page is not responsive for ${operation}: ${error.message}`);
  }
}

/**
 * Enhanced error logging with context information
 * @param {Error} error - Error to log
 * @param {string} context - Context where error occurred
 * @param {Object} additionalInfo - Additional debugging information
 */
function logError(error, context = 'unknown', additionalInfo = {}) {
  const errorInfo = {
    message: error.message,
    stack: error.stack,
    context: context,
    timestamp: new Date().toISOString(),
    ...additionalInfo
  };
  
  logProgress(`ERROR in ${context}: ${error.message}`, 'error');
  
  if (additionalInfo.url) {
    logProgress(`URL: ${additionalInfo.url}`, 'error');
  }
  
  if (additionalInfo.selector) {
    logProgress(`Selector: ${additionalInfo.selector}`, 'error');
  }
  
  if (error.stack && process.env.NODE_ENV === 'development') {
    logProgress(`Stack trace: ${error.stack}`, 'debug');
  }
}

module.exports = {
  waitForElement,
  safeClick,
  extractText,
  extractAttribute,
  delay,
  generateCombinations,
  logProgress,
  logCombinationProgress,
  waitForPageStable,
  selectDropdownOption,
  getDropdownOptions,
  validatePageElements,
  sanitizeText,
  executeWithRetry,
  isRetryableNetworkError,
  isRetryableElementError,
  withTimeout,
  validatePageState,
  logError
};