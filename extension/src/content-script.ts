/**
 * Content Script for IndigoPay Browser Extension
 * Detects Stellar addresses on any webpage and injects "💚 Donate" buttons.
 * Uses Shadow DOM for style isolation.
 */

import { DonateForm } from './donate-form';

// Stellar address regex pattern
const STELLAR_ADDRESS_REGEX = /\bG[A-Z2-7]{55}\b/g;

// Rate limiting for MutationObserver
const MUTATION_DEBOUNCE_MS = 2000;
let mutationDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let lastProcessedTime = 0;

// Track processed nodes to avoid duplicates
const processedNodes = new WeakSet<Node>();

// Settings
let autoDetectEnabled = true;
let excludedDomains: string[] = [];

// Active donation form reference
let activeDonateForm: DonateForm | null = null;

/**
 * Load extension settings
 */
async function loadSettings(): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.sync.get(
      {
        autoDetectEnabled: true,
        excludedDomains: [] as string[],
      },
      (settings) => {
        autoDetectEnabled = settings.autoDetectEnabled as boolean;
        excludedDomains = (settings.excludedDomains as string[]) || [];
        resolve();
      }
    );
  });
}

/**
 * Check if current domain is excluded
 */
function isDomainExcluded(): boolean {
  const currentDomain = window.location.hostname.toLowerCase();
  return excludedDomains.some((domain) => {
    const normalizedDomain = domain.toLowerCase().trim();
    return (
      currentDomain === normalizedDomain ||
      currentDomain.endsWith('.' + normalizedDomain)
    );
  });
}

/**
 * Create the donate button element
 */
function createDonateButton(address: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.className = 'indigopay-donate-btn';
  button.innerHTML = '💚 Donate';
  button.setAttribute('data-address', address);
  button.setAttribute('aria-label', `Donate to Stellar address ${address}`);

  button.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    openDonateForm(address, button);
  });

  return button;
}

/**
 * Create wrapper span for address + button
 */
function createAddressWrapper(
  address: string,
  originalText: string
): HTMLSpanElement {
  const wrapper = document.createElement('span');
  wrapper.className = 'indigopay-address-wrapper';

  // Address span with highlighting
  const addressSpan = document.createElement('span');
  addressSpan.className = 'indigopay-address';
  addressSpan.textContent = originalText;
  addressSpan.setAttribute('data-address', address);

  // Add tooltip on hover
  addressSpan.addEventListener('mouseenter', () => {
    addressSpan.setAttribute('title', 'Click to donate via IndigoPay');
  });

  // Click on address also opens donate form
  addressSpan.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    openDonateForm(address, addressSpan);
  });

  // Donate button
  const button = createDonateButton(address);

  wrapper.appendChild(addressSpan);
  wrapper.appendChild(button);

  return wrapper;
}

/**
 * Open the inline donation form
 */
function openDonateForm(address: string, anchor: HTMLElement) {
  // Close existing form if open
  if (activeDonateForm) {
    activeDonateForm.close();
    activeDonateForm = null;
  }

  // Create new donate form
  const form = document.createElement('indigopay-donate-form') as DonateForm;
  form.setAttribute('address', address);

  // Position relative to anchor
  const rect = anchor.getBoundingClientRect();

  document.body.appendChild(form);

  // Position after appending so dimensions are available
  requestAnimationFrame(() => {
    form.position(rect);
  });

  form.addEventListener('close', () => {
    activeDonateForm = null;
  });

  activeDonateForm = form;
}

/**
 * Process text nodes to find and wrap Stellar addresses
 */
function processTextNode(textNode: Text): void {
  const text = textNode.textContent;
  if (!text) return;

  // Reset regex state
  STELLAR_ADDRESS_REGEX.lastIndex = 0;

  if (!STELLAR_ADDRESS_REGEX.test(text)) return;

  // Reset again for actual matching
  STELLAR_ADDRESS_REGEX.lastIndex = 0;

  const fragment = document.createDocumentFragment();
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = STELLAR_ADDRESS_REGEX.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      fragment.appendChild(
        document.createTextNode(text.substring(lastIndex, match.index))
      );
    }

    // Add the wrapped address
    const wrapper = createAddressWrapper(match[0], match[0]);
    fragment.appendChild(wrapper);

    lastIndex = STELLAR_ADDRESS_REGEX.lastIndex;
  }

  // Add remaining text after last match
  if (lastIndex < text.length) {
    fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
  }

  // Replace the text node with our fragment
  if (textNode.parentNode && fragment.hasChildNodes()) {
    textNode.parentNode.replaceChild(fragment, textNode);
  }
}

/**
 * Walk the DOM and process text nodes
 */
function walkDOM(node: Node): void {
  // Skip already processed nodes
  if (processedNodes.has(node)) return;

  // Skip certain elements
  if (node.nodeType === Node.ELEMENT_NODE) {
    const element = node as HTMLElement;
    const tagName = element.tagName.toUpperCase();

    // Skip script, style, and other non-content elements
    if (
      ['SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'TEXTAREA', 'INPUT'].includes(
        tagName
      )
    ) {
      return;
    }

    // Skip our own injected elements
    if (
      element.classList.contains('indigopay-address-wrapper') ||
      element.classList.contains('indigopay-donate-btn') ||
      element.tagName.toLowerCase() === 'indigopay-donate-form'
    ) {
      return;
    }

    // Skip contenteditable elements
    if (element.isContentEditable) {
      return;
    }
  }

  if (node.nodeType === Node.TEXT_NODE) {
    processedNodes.add(node);
    processTextNode(node as Text);
  } else if (node.nodeType === Node.ELEMENT_NODE) {
    // Mark as processed before recursing to avoid infinite loops
    processedNodes.add(node);

    // Process child nodes (copy to array to avoid mutation issues)
    const children = Array.from(node.childNodes);
    children.forEach((child) => walkDOM(child));
  }
}

/**
 * Process the page for Stellar addresses with rate limiting
 */
function processPage(): void {
  if (!autoDetectEnabled || isDomainExcluded()) return;

  const now = Date.now();
  if (now - lastProcessedTime < MUTATION_DEBOUNCE_MS) {
    // Debounce rapid calls
    if (mutationDebounceTimer) {
      clearTimeout(mutationDebounceTimer);
    }
    mutationDebounceTimer = setTimeout(() => {
      processPage();
    }, MUTATION_DEBOUNCE_MS);
    return;
  }

  lastProcessedTime = now;
  walkDOM(document.body);
}

/**
 * Check for project context on IndigoPay pages
 */
let currentProjectId: string | null = null;

function checkProjectContext(): void {
  const metaTag =
    document.querySelector('meta[name="indigopay:project:id"]') ||
    document.querySelector('meta[property="indigopay:project:id"]');
  let projectId = metaTag ? metaTag.getAttribute('content') : null;

  if (!projectId) {
    const match = window.location.pathname.match(
      /\/projects\/([a-zA-Z0-9_-]+)/
    );
    if (match) projectId = match[1];
  }

  if (projectId !== currentProjectId) {
    currentProjectId = projectId;
    chrome.runtime
      .sendMessage({ action: 'setProjectContext', projectId })
      .catch(() => {});
  }
}

/**
 * Set up MutationObserver for dynamic content (SPA, AJAX)
 */
function setupMutationObserver(): void {
  const observer = new MutationObserver((mutations) => {
    let hasNewContent = false;

    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (
          node.nodeType === Node.ELEMENT_NODE ||
          node.nodeType === Node.TEXT_NODE
        ) {
          // Check if it contains potential addresses before processing
          const text =
            node.nodeType === Node.TEXT_NODE
              ? node.textContent
              : (node as HTMLElement).textContent;
          if (text && /G[A-Z2-7]{55}/.test(text)) {
            hasNewContent = true;
          }
        }
      });
    });

    if (hasNewContent) {
      // Debounced processing
      if (mutationDebounceTimer) {
        clearTimeout(mutationDebounceTimer);
      }
      mutationDebounceTimer = setTimeout(() => {
        processPage();
      }, MUTATION_DEBOUNCE_MS);
    }

    // Always check project context
    checkProjectContext();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

/**
 * Handle visibility change (for SPA tab switching)
 */
function handleVisibilityChange(): void {
  if (document.visibilityState === 'visible') {
    processPage();
    checkProjectContext();
  }
}

/**
 * Initialize the content script
 */
async function initialize(): Promise<void> {
  await loadSettings();

  if (!autoDetectEnabled || isDomainExcluded()) {
    console.log('[IndigoPay] Auto-detect disabled or domain excluded');
    return;
  }

  // Initial processing
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      processPage();
      checkProjectContext();
    });
  } else {
    processPage();
    checkProjectContext();
  }

  // Set up observers
  setupMutationObserver();

  // Handle SPA navigation
  window.addEventListener('popstate', () => {
    processPage();
    checkProjectContext();
  });

  // Handle visibility changes
  document.addEventListener('visibilitychange', handleVisibilityChange);

  // Listen for settings changes
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync') {
      if (changes.autoDetectEnabled !== undefined) {
        autoDetectEnabled = changes.autoDetectEnabled.newValue as boolean;
      }
      if (changes.excludedDomains !== undefined) {
        excludedDomains = (changes.excludedDomains.newValue as string[]) || [];
      }
    }
  });

  console.log('[IndigoPay] Content script initialized with inline donations');
}

/**
 * Handle messages from background script
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'GET_PUBLIC_KEY') {
    getPublicKey()
      .then((publicKey) => {
        sendResponse({ publicKey });
      })
      .catch((error) => {
        sendResponse({ error: error.message });
      });
    return true; // Keep channel open for async response
  }
});

/**
 * Get public key from Freighter wallet
 */
async function getPublicKey(): Promise<string> {
  const freighter = (window as any).freighter;
  if (!freighter) {
    throw new Error('Freighter wallet not found');
  }
  return await freighter.getPublicKey();
}

// Start initialization
initialize();
