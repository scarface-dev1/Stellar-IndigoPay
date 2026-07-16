/**
 * Shadow DOM Donation Form Component
 * Injected inline next to detected Stellar addresses on any webpage.
 * Isolated styles prevent conflicts with host page CSS.
 */

export interface DonateFormConfig {
  address: string;
  projectName?: string;
  projectId?: string;
  category?: string;
}

export interface ProjectInfo {
  id: string;
  name: string;
  category: string;
  description?: string;
  walletAddress: string;
  isRegistered: boolean;
}

type FormState = 'idle' | 'loading' | 'ready' | 'signing' | 'submitting' | 'success' | 'error';

const QUICK_AMOUNTS = [1, 5, 10, 25];

const FORM_STYLES = `
  :host {
    all: initial;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
    font-size: 14px;
    line-height: 1.5;
  }

  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  .donate-popover {
    position: absolute;
    z-index: 2147483647;
    background: linear-gradient(135deg, #1a1f2e 0%, #0d1117 100%);
    border: 1px solid rgba(99, 102, 241, 0.3);
    border-radius: 16px;
    padding: 20px;
    width: 320px;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5),
                0 0 0 1px rgba(255, 255, 255, 0.05);
    color: #fff;
    animation: slideIn 0.2s ease-out;
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .popover-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 16px;
  }

  .popover-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 16px;
    font-weight: 600;
    color: #fff;
  }

  .popover-title .logo {
    font-size: 20px;
  }

  .close-btn {
    background: rgba(255, 255, 255, 0.1);
    border: none;
    border-radius: 8px;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: #94a3b8;
    font-size: 18px;
    transition: all 0.2s;
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.2);
    color: #fff;
  }

  .project-info {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 12px;
    padding: 12px;
    margin-bottom: 16px;
  }

  .project-name {
    font-weight: 600;
    color: #fff;
    margin-bottom: 4px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .project-category {
    font-size: 12px;
    color: #94a3b8;
  }

  .project-unregistered {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #fca5a5;
    font-size: 12px;
    padding: 8px 12px;
    border-radius: 8px;
    margin-bottom: 16px;
  }

  .address-display {
    font-family: 'SF Mono', Monaco, 'Courier New', monospace;
    font-size: 11px;
    color: #64748b;
    word-break: break-all;
    margin-top: 8px;
    padding: 8px;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 6px;
  }

  .quick-amounts {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    margin-bottom: 12px;
  }

  .quick-amount-btn {
    background: rgba(99, 102, 241, 0.1);
    border: 1px solid rgba(99, 102, 241, 0.3);
    border-radius: 8px;
    padding: 10px 8px;
    color: #a5b4fc;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .quick-amount-btn:hover {
    background: rgba(99, 102, 241, 0.2);
    border-color: rgba(99, 102, 241, 0.5);
  }

  .quick-amount-btn.selected {
    background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
    border-color: #6366f1;
    color: #fff;
  }

  .custom-amount {
    margin-bottom: 12px;
  }

  .input-wrapper {
    position: relative;
  }

  .amount-input {
    width: 100%;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    padding: 12px 50px 12px 16px;
    color: #fff;
    font-size: 16px;
    outline: none;
    transition: border-color 0.2s;
  }

  .amount-input:focus {
    border-color: rgba(99, 102, 241, 0.5);
  }

  .amount-input::placeholder {
    color: #64748b;
  }

  .currency-label {
    position: absolute;
    right: 16px;
    top: 50%;
    transform: translateY(-50%);
    color: #94a3b8;
    font-size: 14px;
    font-weight: 500;
  }

  .message-field {
    margin-bottom: 16px;
  }

  .message-input {
    width: 100%;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    padding: 12px 16px;
    color: #fff;
    font-size: 14px;
    outline: none;
    resize: none;
    min-height: 60px;
    transition: border-color 0.2s;
  }

  .message-input:focus {
    border-color: rgba(99, 102, 241, 0.5);
  }

  .message-input::placeholder {
    color: #64748b;
  }

  .donate-btn {
    width: 100%;
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    border: none;
    border-radius: 12px;
    padding: 14px 20px;
    color: #fff;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: all 0.2s;
  }

  .donate-btn:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 10px 20px -10px rgba(16, 185, 129, 0.5);
  }

  .donate-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .donate-btn.loading {
    background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
  }

  .spinner {
    width: 18px;
    height: 18px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .status-message {
    margin-top: 12px;
    padding: 10px 12px;
    border-radius: 8px;
    font-size: 13px;
    text-align: center;
  }

  .status-message.success {
    background: rgba(16, 185, 129, 0.1);
    border: 1px solid rgba(16, 185, 129, 0.3);
    color: #6ee7b7;
  }

  .status-message.error {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #fca5a5;
  }

  .success-content {
    text-align: center;
    padding: 20px 0;
  }

  .success-icon {
    font-size: 48px;
    margin-bottom: 12px;
  }

  .success-title {
    font-size: 18px;
    font-weight: 600;
    margin-bottom: 8px;
  }

  .success-amount {
    color: #6ee7b7;
    font-size: 24px;
    font-weight: 700;
    margin-bottom: 8px;
  }

  .success-tx {
    font-size: 12px;
    color: #64748b;
  }

  .success-tx a {
    color: #a5b4fc;
    text-decoration: none;
  }

  .success-tx a:hover {
    text-decoration: underline;
  }

  .loading-skeleton {
    background: linear-gradient(90deg,
      rgba(255, 255, 255, 0.05) 25%,
      rgba(255, 255, 255, 0.1) 50%,
      rgba(255, 255, 255, 0.05) 75%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 8px;
  }

  @keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }

  .skeleton-project {
    height: 60px;
    margin-bottom: 16px;
  }

  .skeleton-amounts {
    height: 44px;
    margin-bottom: 12px;
  }

  .hidden {
    display: none !important;
  }
`;

export class DonateForm extends HTMLElement {
  private shadow: ShadowRoot;
  private config: DonateFormConfig;
  private projectInfo: ProjectInfo | null = null;
  private state: FormState = 'idle';
  private selectedAmount: number | null = null;
  private txHash: string | null = null;
  private networkPassphrase: string = 'Test SDF Network ; September 2015';
  private horizonUrl: string = 'https://horizon-testnet.stellar.org';

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'closed' });
    this.config = { address: '' };
  }

  static get observedAttributes() {
    return ['address', 'project-name', 'project-id', 'category'];
  }

  connectedCallback() {
    this.config = {
      address: this.getAttribute('address') || '',
      projectName: this.getAttribute('project-name') || undefined,
      projectId: this.getAttribute('project-id') || undefined,
      category: this.getAttribute('category') || undefined,
    };

    this.loadSettings().then(() => {
      this.render();
      this.fetchProjectInfo();
    });
  }

  private async loadSettings(): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.sync.get({
        network: 'testnet',
        defaultDonationAmount: '5',
      }, (settings) => {
        if ((settings.network as string) === 'mainnet') {
          this.networkPassphrase = 'Public Global Stellar Network ; September 2015';
          this.horizonUrl = 'https://horizon.stellar.org';
        }
        if (settings.defaultDonationAmount) {
          this.selectedAmount = parseFloat(settings.defaultDonationAmount as string);
        }
        resolve();
      });
    });
  }

  private async fetchProjectInfo(): Promise<void> {
    this.setState('loading');

    try {
      const response = await new Promise<any>((resolve, reject) => {
        chrome.runtime.sendMessage(
          { action: 'FETCH_PROJECT_INFO', address: this.config.address },
          (response) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(response);
            }
          }
        );
      });

      if (response?.success && response.project) {
        this.projectInfo = response.project;
      } else {
        this.projectInfo = {
          id: '',
          name: 'Unknown Address',
          category: '',
          walletAddress: this.config.address,
          isRegistered: false,
        };
      }

      this.setState('ready');
    } catch (error) {
      console.error('Failed to fetch project info:', error);
      this.projectInfo = {
        id: '',
        name: 'Unknown Address',
        category: '',
        walletAddress: this.config.address,
        isRegistered: false,
      };
      this.setState('ready');
    }
  }

  private setState(state: FormState) {
    this.state = state;
    this.render();
  }

  private getProjectEmoji(category: string): string {
    const map: Record<string, string> = {
      'Reforestation': '🌳',
      'Solar Energy': '☀️',
      'Ocean Conservation': '🌊',
      'Clean Water': '💧',
      'Wildlife Protection': '🦁',
      'Carbon Capture': '♻️',
      'Wind Energy': '💨',
      'Sustainable Agriculture': '🌾',
    };
    return map[category] ?? '🌿';
  }

  private truncateAddress(address: string): string {
    if (address.length <= 16) return address;
    return `${address.slice(0, 8)}...${address.slice(-8)}`;
  }

  private render() {
    const styleEl = document.createElement('style');
    styleEl.textContent = FORM_STYLES;

    const container = document.createElement('div');
    container.className = 'donate-popover';

    if (this.state === 'success') {
      container.innerHTML = this.renderSuccess();
    } else if (this.state === 'loading') {
      container.innerHTML = this.renderLoading();
    } else {
      container.innerHTML = this.renderForm();
    }

    this.shadow.innerHTML = '';
    this.shadow.appendChild(styleEl);
    this.shadow.appendChild(container);

    this.attachEventListeners();
  }

  private renderLoading(): string {
    return `
      <div class="popover-header">
        <div class="popover-title">
          <span class="logo">🌿</span>
          <span>IndigoPay</span>
        </div>
        <button class="close-btn" data-action="close">×</button>
      </div>
      <div class="loading-skeleton skeleton-project"></div>
      <div class="loading-skeleton skeleton-amounts"></div>
      <div class="donate-btn loading" disabled>
        <div class="spinner"></div>
        Loading...
      </div>
    `;
  }

  private renderForm(): string {
    const project = this.projectInfo;
    const isRegistered = project?.isRegistered ?? false;

    return `
      <div class="popover-header">
        <div class="popover-title">
          <span class="logo">🌿</span>
          <span>IndigoPay</span>
        </div>
        <button class="close-btn" data-action="close">×</button>
      </div>

      ${project ? `
        <div class="project-info">
          <div class="project-name">
            <span>${this.getProjectEmoji(project.category)}</span>
            <span>${this.escapeHtml(project.name)}</span>
          </div>
          ${project.category ? `<div class="project-category">${this.escapeHtml(project.category)}</div>` : ''}
          <div class="address-display">${this.truncateAddress(this.config.address)}</div>
        </div>
      ` : ''}

      ${!isRegistered ? `
        <div class="project-unregistered">
          ⚠️ This address is not a registered IndigoPay project. Proceed with caution.
        </div>
      ` : ''}

      <div class="quick-amounts">
        ${QUICK_AMOUNTS.map(amount => `
          <button class="quick-amount-btn ${this.selectedAmount === amount ? 'selected' : ''}"
                  data-amount="${amount}">
            ${amount} XLM
          </button>
        `).join('')}
      </div>

      <div class="custom-amount">
        <div class="input-wrapper">
          <input type="number"
                 class="amount-input"
                 placeholder="Custom amount"
                 step="0.1"
                 min="0.1"
                 value="${this.selectedAmount && !QUICK_AMOUNTS.includes(this.selectedAmount) ? this.selectedAmount : ''}"
                 data-input="amount">
          <span class="currency-label">XLM</span>
        </div>
      </div>

      <div class="message-field">
        <textarea class="message-input"
                  placeholder="Add a message (optional)"
                  data-input="message"></textarea>
      </div>

      <button class="donate-btn ${this.state === 'signing' || this.state === 'submitting' ? 'loading' : ''}"
              data-action="donate"
              ${!this.selectedAmount || this.state === 'signing' || this.state === 'submitting' ? 'disabled' : ''}>
        ${this.state === 'signing' ? `<div class="spinner"></div> Signing...` :
          this.state === 'submitting' ? `<div class="spinner"></div> Submitting...` :
          `💚 Donate with Freighter`}
      </button>

      ${this.state === 'error' ? `
        <div class="status-message error">
          Transaction failed. Please try again.
        </div>
      ` : ''}
    `;
  }

  private renderSuccess(): string {
    const explorerUrl = this.networkPassphrase.includes('Test')
      ? `https://stellar.expert/explorer/testnet/tx/${this.txHash}`
      : `https://stellar.expert/explorer/public/tx/${this.txHash}`;

    return `
      <div class="popover-header">
        <div class="popover-title">
          <span class="logo">🌿</span>
          <span>IndigoPay</span>
        </div>
        <button class="close-btn" data-action="close">×</button>
      </div>

      <div class="success-content">
        <div class="success-icon">🎉</div>
        <div class="success-title">Thank you!</div>
        <div class="success-amount">${this.selectedAmount} XLM</div>
        <div class="success-tx">
          <a href="${explorerUrl}" target="_blank" rel="noopener noreferrer">
            View transaction →
          </a>
        </div>
      </div>

      <button class="donate-btn" data-action="close">
        Done
      </button>
    `;
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private attachEventListeners() {
    // Close button
    const closeBtn = this.shadow.querySelector('[data-action="close"]');
    closeBtn?.addEventListener('click', () => this.close());

    // Quick amount buttons
    const amountBtns = this.shadow.querySelectorAll('.quick-amount-btn');
    amountBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const amount = parseFloat((e.target as HTMLElement).dataset.amount || '0');
        this.selectedAmount = amount;

        // Clear custom input
        const customInput = this.shadow.querySelector('[data-input="amount"]') as HTMLInputElement;
        if (customInput) customInput.value = '';

        this.render();
      });
    });

    // Custom amount input
    const amountInput = this.shadow.querySelector('[data-input="amount"]') as HTMLInputElement;
    amountInput?.addEventListener('input', (e) => {
      const value = parseFloat((e.target as HTMLInputElement).value);
      if (!isNaN(value) && value > 0) {
        this.selectedAmount = value;
        // Deselect quick amounts visually
        const btns = this.shadow.querySelectorAll('.quick-amount-btn');
        btns.forEach(btn => btn.classList.remove('selected'));
      }
    });

    // Donate button
    const donateBtn = this.shadow.querySelector('[data-action="donate"]');
    donateBtn?.addEventListener('click', () => this.handleDonate());

    // Click outside to close
    this.addEventListener('click', (e) => {
      if (e.target === this) {
        this.close();
      }
    });

    // Escape key to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.close();
      }
    });
  }

  private async handleDonate() {
    if (!this.selectedAmount || this.selectedAmount <= 0) return;

    const messageInput = this.shadow.querySelector('[data-input="message"]') as HTMLTextAreaElement;
    const message = messageInput?.value || '';

    this.setState('signing');

    try {
      // Build transaction via background script
      const buildResponse = await new Promise<any>((resolve, reject) => {
        chrome.runtime.sendMessage(
          {
            action: 'BUILD_TRANSACTION',
            destination: this.config.address,
            amount: this.selectedAmount!.toString(),
            memo: message,
          },
          (response) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(response);
            }
          }
        );
      });

      if (!buildResponse?.success || !buildResponse.xdr) {
        throw new Error(buildResponse?.error || 'Failed to build transaction');
      }

      // Sign with Freighter
      const freighter = (window as any).freighter;
      if (!freighter) {
        throw new Error('Freighter wallet not found. Please install Freighter.');
      }

      const signedXdr = await freighter.signTransaction(buildResponse.xdr, {
        networkPassphrase: this.networkPassphrase,
      });

      this.setState('submitting');

      // Submit transaction via background script
      const submitResponse = await new Promise<any>((resolve, reject) => {
        chrome.runtime.sendMessage(
          {
            action: 'SUBMIT_TRANSACTION',
            signedXdr,
            amount: this.selectedAmount,
            projectId: this.projectInfo?.id,
          },
          (response) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(response);
            }
          }
        );
      });

      if (!submitResponse?.success) {
        throw new Error(submitResponse?.error || 'Failed to submit transaction');
      }

      this.txHash = submitResponse.hash;
      this.setState('success');

      // Record inline donation for popup display
      this.recordInlineDonation();

    } catch (error: any) {
      console.error('Donation failed:', error);
      this.setState('error');
    }
  }

  private recordInlineDonation() {
    chrome.storage.local.get(['recentInlineDonations'], (result) => {
      const donations = (result.recentInlineDonations as Array<{
        address: string;
        amount: number | null;
        projectName: string;
        timestamp: number;
        txHash: string | null;
      }>) || [];
      donations.unshift({
        address: this.config.address,
        amount: this.selectedAmount,
        projectName: this.projectInfo?.name || 'Unknown',
        timestamp: Date.now(),
        txHash: this.txHash,
      });
      // Keep only last 10
      chrome.storage.local.set({
        recentInlineDonations: donations.slice(0, 10),
      });
    });
  }

  public close() {
    this.dispatchEvent(new CustomEvent('close'));
    this.remove();
  }

  public position(anchorRect: DOMRect) {
    const popover = this.shadow.querySelector('.donate-popover') as HTMLElement;
    if (!popover) return;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const popoverWidth = 320;
    const popoverHeight = 450;

    let left = anchorRect.left;
    let top = anchorRect.bottom + 8;

    // Adjust if going off right edge
    if (left + popoverWidth > viewportWidth - 16) {
      left = viewportWidth - popoverWidth - 16;
    }

    // Adjust if going off bottom edge
    if (top + popoverHeight > viewportHeight - 16) {
      top = anchorRect.top - popoverHeight - 8;
    }

    // Ensure not off left edge
    if (left < 16) {
      left = 16;
    }

    popover.style.left = `${left}px`;
    popover.style.top = `${top + window.scrollY}px`;
  }
}

// Register the custom element
if (!customElements.get('indigopay-donate-form')) {
  customElements.define('indigopay-donate-form', DonateForm);
}
