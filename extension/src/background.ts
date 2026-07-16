/**
 * Background Service Worker for IndigoPay Browser Extension
 * Handles context menus, tab tracking, and message routing for inline donations.
 */

import {
  Asset,
  Horizon,
  Networks,
  Operation,
  TransactionBuilder,
  Memo,
} from '@stellar/stellar-sdk';

// Tab to project mapping
const tabProjects = new Map<number, string>();

// API and network configuration
let API_BASE = 'https://api.stellar-indigopay.app';
let NETWORK_PASSPHRASE: string = Networks.TESTNET;
let horizonUrl = 'https://horizon-testnet.stellar.org';
let server = new Horizon.Server(horizonUrl);

/**
 * Load settings on startup and apply configuration
 */
async function loadAndApplySettings(): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.sync.get(
      {
        backendUrl: 'https://api.stellar-indigopay.app',
        network: 'testnet',
      },
      (settings) => {
        API_BASE = settings.backendUrl as string;
        if ((settings.network as string) === 'mainnet') {
          NETWORK_PASSPHRASE = Networks.PUBLIC;
          horizonUrl = 'https://horizon.stellar.org';
        } else {
          NETWORK_PASSPHRASE = Networks.TESTNET;
          horizonUrl = 'https://horizon-testnet.stellar.org';
        }
        server = new Horizon.Server(horizonUrl);
        resolve();
      }
    );
  });
}

// Initialize settings on load
loadAndApplySettings();

// Listen for settings changes
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync') {
    if (changes.backendUrl) {
      API_BASE = changes.backendUrl.newValue as string;
    }
    if (changes.network) {
      if (changes.network.newValue === 'mainnet') {
        NETWORK_PASSPHRASE = Networks.PUBLIC;
        horizonUrl = 'https://horizon.stellar.org';
      } else {
        NETWORK_PASSPHRASE = Networks.TESTNET;
        horizonUrl = 'https://horizon-testnet.stellar.org';
      }
      server = new Horizon.Server(horizonUrl);
    }
  }
});

/**
 * Create context menu on install
 */
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'donate-project',
    title: 'Donate to this IndigoPay project',
    contexts: ['all'],
    visible: false,
    documentUrlPatterns: ['*://*/*'],
  });
});

/**
 * Message handler for all extension messages
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle project context from content script
  if (message.action === 'setProjectContext' && sender.tab?.id) {
    if (message.projectId) {
      tabProjects.set(sender.tab.id, message.projectId);
      updateContextMenu(sender.tab.id);
    } else {
      tabProjects.delete(sender.tab.id);
      updateContextMenu(sender.tab.id);
    }
    return;
  }

  // Handle click on Stellar address from content script
  if (message.action === 'openDonatePopup' && message.address) {
    chrome.storage.local.set({ pendingDonationAddress: message.address }, () => {
      openPopup();
    });
    return;
  }

  // Handle FETCH_PROJECT_INFO from donate form
  if (message.action === 'FETCH_PROJECT_INFO') {
    handleFetchProjectInfo(message.address)
      .then(sendResponse)
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true; // Keep channel open for async response
  }

  // Handle BUILD_TRANSACTION from donate form
  if (message.action === 'BUILD_TRANSACTION') {
    handleBuildTransaction(message.destination, message.amount, message.memo)
      .then(sendResponse)
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  // Handle SUBMIT_TRANSACTION from donate form
  if (message.action === 'SUBMIT_TRANSACTION') {
    handleSubmitTransaction(message.signedXdr, message.amount, message.projectId)
      .then(sendResponse)
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

/**
 * Fetch project info from backend API
 */
async function handleFetchProjectInfo(
  address: string
): Promise<{ success: boolean; project?: any; error?: string }> {
  try {
    // First try to find by wallet address
    const response = await fetch(
      `${API_BASE}/api/projects?walletAddress=${encodeURIComponent(address)}`
    );

    if (response.ok) {
      const data = await response.json();
      if (data.data && data.data.length > 0) {
        const project = data.data[0];
        return {
          success: true,
          project: {
            id: project.id,
            name: project.name,
            category: project.category,
            description: project.description,
            walletAddress: project.walletAddress,
            isRegistered: true,
          },
        };
      }
    }

    // Not a registered project
    return {
      success: true,
      project: {
        id: '',
        name: 'Unregistered Address',
        category: '',
        walletAddress: address,
        isRegistered: false,
      },
    };
  } catch (error: any) {
    console.error('Failed to fetch project info:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch project info',
    };
  }
}

/**
 * Build a donation transaction
 */
async function handleBuildTransaction(
  destination: string,
  amount: string,
  memo?: string
): Promise<{ success: boolean; xdr?: string; sourcePublicKey?: string; error?: string }> {
  try {
    // Get the user's public key from Freighter via content script
    // We need to request this through a different mechanism since service workers
    // don't have access to window.freighter

    // For now, we'll return an unsigned transaction envelope that the content script
    // will sign using Freighter

    // First, we need the source account. We'll use a proxy approach where
    // the donate-form gets the public key and sends it to us
    const sourceResponse = await new Promise<string>((resolve, reject) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(
            tabs[0].id,
            { action: 'GET_PUBLIC_KEY' },
            (response) => {
              if (chrome.runtime.lastError) {
                reject(new Error('Could not get public key'));
              } else if (response?.publicKey) {
                resolve(response.publicKey);
              } else {
                reject(new Error('No public key returned'));
              }
            }
          );
        } else {
          reject(new Error('No active tab'));
        }
      });
    });

    const sourcePublicKey = sourceResponse;

    // Load the source account
    const sourceAccount = await server.loadAccount(sourcePublicKey);

    // Build the transaction
    const transactionBuilder = new TransactionBuilder(sourceAccount, {
      fee: '100',
      networkPassphrase: NETWORK_PASSPHRASE,
    });

    // Add payment operation
    transactionBuilder.addOperation(
      Operation.payment({
        destination,
        asset: Asset.native(),
        amount,
      })
    );

    // Add memo if provided
    if (memo && memo.trim()) {
      transactionBuilder.addMemo(Memo.text(memo.substring(0, 28)));
    }

    // Set timeout
    transactionBuilder.setTimeout(180);

    // Build the transaction
    const transaction = transactionBuilder.build();

    return {
      success: true,
      xdr: transaction.toXDR(),
      sourcePublicKey,
    };
  } catch (error: any) {
    console.error('Failed to build transaction:', error);
    return {
      success: false,
      error: error.message || 'Failed to build transaction',
    };
  }
}

/**
 * Submit a signed transaction
 */
async function handleSubmitTransaction(
  signedXdr: string,
  amount?: number,
  projectId?: string
): Promise<{ success: boolean; hash?: string; error?: string }> {
  try {
    // Reconstruct and submit the transaction
    const transaction = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);
    const result = await server.submitTransaction(transaction as any);
    const hash = (result as any).hash;

    // Update total donated
    if (amount) {
      chrome.storage.local.get(['totalDonatedXLM'], (result) => {
        const current = (result.totalDonatedXLM as number) || 0;
        const newTotal = current + amount;
        chrome.storage.local.set({ totalDonatedXLM: newTotal });

        // Update badge
        updateDonationBadge(newTotal);
      });
    }

    // Record donation to backend if we have a project ID
    if (projectId) {
      try {
        await fetch(`${API_BASE}/api/donations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId,
            amount,
            txHash: hash,
            source: 'inline',
          }),
        });
      } catch (e) {
        console.warn('Failed to record donation to backend:', e);
      }
    }

    return {
      success: true,
      hash,
    };
  } catch (error: any) {
    console.error('Failed to submit transaction:', error);
    return {
      success: false,
      error: error.message || 'Failed to submit transaction',
    };
  }
}

/**
 * Update donation badge on extension icon
 */
function abbreviateNumber(num: number): string {
  if (num < 1000) return Math.floor(num).toString();
  if (num < 1000000) return Math.floor(num / 1000) + 'K';
  return (num / 1000000).toFixed(1) + 'M';
}

async function updateDonationBadge(totalXLM: number): Promise<void> {
  const text = abbreviateNumber(totalXLM);
  try {
    await chrome.action.setBadgeText({ text });
    await chrome.action.setBadgeBackgroundColor({ color: '#10b981' });
  } catch (e) {
    console.error('Badge update failed:', e);
  }
}

/**
 * Tab event handlers
 */
chrome.tabs.onActivated.addListener(({ tabId }) => {
  updateContextMenu(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'complete' || changeInfo.url) {
    // Content script will re-evaluate and send 'setProjectContext'
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  tabProjects.delete(tabId);
});

/**
 * Update context menu visibility based on tab context
 */
function updateContextMenu(tabId: number): void {
  const projectId = tabProjects.get(tabId);
  chrome.contextMenus.update('donate-project', { visible: !!projectId }, () => {
    if (chrome.runtime.lastError) {
      // Ignore error if menu item doesn't exist yet
    }
  });
}

/**
 * Context menu click handler
 */
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'donate-project' && tab?.id) {
    const projectId = tabProjects.get(tab.id);
    if (projectId) {
      chrome.storage.local.set({ pendingDonationProjectId: projectId }, () => {
        openPopup();
      });
    }
  }
});

/**
 * Open the extension popup programmatically
 */
function openPopup(): void {
  if (chrome.action && chrome.action.openPopup) {
    chrome.action.openPopup().catch(console.error);
  } else if ((globalThis as any).browser?.action?.openPopup) {
    (globalThis as any).browser.action.openPopup().catch(console.error);
  } else if ((globalThis as any).browser?.browserAction?.openPopup) {
    (globalThis as any).browser.browserAction.openPopup().catch(console.error);
  } else {
    console.error(
      'Cannot programmatically open popup in this browser environment.'
    );
  }
}

console.log('[IndigoPay] Background service worker initialized');
