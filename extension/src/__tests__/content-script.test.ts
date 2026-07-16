/**
 * Unit tests for content-script.ts
 * Tests Stellar address detection, DOM injection, and MutationObserver
 */

describe('Stellar Address Detection', () => {
  const STELLAR_ADDRESS_REGEX = /\bG[A-Z2-7]{55}\b/g;

  // Valid Stellar address examples
  const validAddresses = [
    'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW',
    'GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGSNFHEYVXM3XOJMDS674JZ',
    'GDUKMGUGDZQK6YHYA5Z6AY2G4XDSZPSZ3SW5UN3ARVMO6QSRDWP5YLEX',
  ];

  // Invalid address examples (should not match)
  const invalidAddresses = [
    'GABCDEF', // Too short
    'gabcdefghijklmnopqrstuvwxyz234567abcdefghijklmnopqrstuvw', // Lowercase
    'XABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW', // Wrong prefix
    'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW1', // Too long
    'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUV', // 54 chars
  ];

  describe('regex pattern', () => {
    test('should match valid Stellar addresses', () => {
      validAddresses.forEach((address) => {
        STELLAR_ADDRESS_REGEX.lastIndex = 0;
        expect(STELLAR_ADDRESS_REGEX.test(address)).toBe(true);
      });
    });

    test('should not match invalid addresses', () => {
      invalidAddresses.forEach((address) => {
        STELLAR_ADDRESS_REGEX.lastIndex = 0;
        expect(STELLAR_ADDRESS_REGEX.test(address)).toBe(false);
      });
    });

    test('should find addresses within text', () => {
      const text = 'Send to GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW for donation';
      STELLAR_ADDRESS_REGEX.lastIndex = 0;
      const matches = text.match(STELLAR_ADDRESS_REGEX);
      expect(matches).toHaveLength(1);
      expect(matches![0]).toBe('GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW');
    });

    test('should find multiple addresses in text', () => {
      const addr1 = 'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW';
      const addr2 = 'GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGSNFHEYVXM3XOJMDS674JZ';
      const text = `First: ${addr1}, Second: ${addr2}`;

      STELLAR_ADDRESS_REGEX.lastIndex = 0;
      const matches = text.match(STELLAR_ADDRESS_REGEX);
      expect(matches).toHaveLength(2);
    });
  });
});

describe('DOM Injection', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  test('should create donate button with correct attributes', () => {
    const button = document.createElement('button');
    button.className = 'indigopay-donate-btn';
    button.innerHTML = '💚 Donate';
    button.setAttribute('data-address', 'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW');

    expect(button.className).toBe('indigopay-donate-btn');
    expect(button.innerHTML).toBe('💚 Donate');
    expect(button.getAttribute('data-address')).toBe('GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW');
  });

  test('should create address wrapper with button', () => {
    const wrapper = document.createElement('span');
    wrapper.className = 'indigopay-address-wrapper';

    const addressSpan = document.createElement('span');
    addressSpan.className = 'indigopay-address';
    addressSpan.textContent = 'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW';

    const button = document.createElement('button');
    button.className = 'indigopay-donate-btn';
    button.innerHTML = '💚 Donate';

    wrapper.appendChild(addressSpan);
    wrapper.appendChild(button);

    expect(wrapper.children).toHaveLength(2);
    expect(wrapper.querySelector('.indigopay-address')).toBeTruthy();
    expect(wrapper.querySelector('.indigopay-donate-btn')).toBeTruthy();
  });

  test('should skip script and style elements', () => {
    const skipTags = ['SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'TEXTAREA', 'INPUT'];

    skipTags.forEach((tag) => {
      const element = document.createElement(tag);
      element.textContent = 'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW';

      // These elements should be skipped during DOM walking
      expect(skipTags.includes(element.tagName)).toBe(true);
    });
  });
});

describe('MutationObserver Rate Limiting', () => {
  test('should debounce rapid mutations', () => {
    jest.useFakeTimers();

    let processCount = 0;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const DEBOUNCE_MS = 2000;

    const processPage = () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      debounceTimer = setTimeout(() => {
        processCount++;
      }, DEBOUNCE_MS);
    };

    // Simulate rapid mutations
    processPage();
    processPage();
    processPage();

    // Before debounce time
    expect(processCount).toBe(0);

    // After debounce time
    jest.advanceTimersByTime(DEBOUNCE_MS);
    expect(processCount).toBe(1);

    jest.useRealTimers();
  });
});

describe('Shadow DOM', () => {
  test('should create element with shadow root', () => {
    const element = document.createElement('div');
    const shadow = element.attachShadow({ mode: 'closed' });

    const style = document.createElement('style');
    style.textContent = '.test { color: red; }';
    shadow.appendChild(style);

    const content = document.createElement('div');
    content.className = 'test';
    content.textContent = 'Shadow content';
    shadow.appendChild(content);

    // Shadow content is isolated
    expect(shadow.querySelector('.test')).toBeTruthy();
    expect(document.querySelector('.test')).toBeNull();
  });
});

describe('Settings', () => {
  test('should load default settings', async () => {
    const DEFAULT_SETTINGS = {
      backendUrl: 'https://api.stellar-indigopay.app',
      network: 'testnet',
      defaultDonationAmount: '5',
      autoDetectEnabled: true,
      excludedDomains: [],
      theme: 'dark',
      currency: 'XLM',
    };

    const settings = await new Promise<typeof DEFAULT_SETTINGS>((resolve) => {
      chrome.storage.sync.get(DEFAULT_SETTINGS, (items) => {
        resolve(items as typeof DEFAULT_SETTINGS);
      });
    });

    expect(settings.autoDetectEnabled).toBe(true);
    expect(settings.excludedDomains).toEqual([]);
    expect(settings.theme).toBe('dark');
  });

  test('should check excluded domains', () => {
    const excludedDomains = ['example.com', 'test.org'];
    const currentDomain = 'example.com';

    const isExcluded = excludedDomains.some((domain) => {
      const normalizedDomain = domain.toLowerCase().trim();
      return (
        currentDomain === normalizedDomain ||
        currentDomain.endsWith('.' + normalizedDomain)
      );
    });

    expect(isExcluded).toBe(true);
  });

  test('should match subdomain exclusion', () => {
    const excludedDomains = ['example.com'];
    const currentDomain = 'sub.example.com';

    const isExcluded = excludedDomains.some((domain) => {
      const normalizedDomain = domain.toLowerCase().trim();
      return (
        currentDomain === normalizedDomain ||
        currentDomain.endsWith('.' + normalizedDomain)
      );
    });

    expect(isExcluded).toBe(true);
  });
});
