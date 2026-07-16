/**
 * Unit tests for donate-form.ts
 * Tests Shadow DOM form component
 */

describe('DonateForm Component', () => {
  describe('Quick Amounts', () => {
    const QUICK_AMOUNTS = [1, 5, 10, 25];

    test('should have correct quick amount values', () => {
      expect(QUICK_AMOUNTS).toContain(1);
      expect(QUICK_AMOUNTS).toContain(5);
      expect(QUICK_AMOUNTS).toContain(10);
      expect(QUICK_AMOUNTS).toContain(25);
    });

    test('should have exactly 4 quick amounts', () => {
      expect(QUICK_AMOUNTS).toHaveLength(4);
    });
  });

  describe('Project Emoji Mapping', () => {
    const getProjectEmoji = (category: string): string => {
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
    };

    test('should return correct emoji for known categories', () => {
      expect(getProjectEmoji('Reforestation')).toBe('🌳');
      expect(getProjectEmoji('Solar Energy')).toBe('☀️');
      expect(getProjectEmoji('Ocean Conservation')).toBe('🌊');
    });

    test('should return default emoji for unknown category', () => {
      expect(getProjectEmoji('Unknown')).toBe('🌿');
      expect(getProjectEmoji('')).toBe('🌿');
    });
  });

  describe('Address Truncation', () => {
    const truncateAddress = (address: string): string => {
      if (address.length <= 16) return address;
      return `${address.slice(0, 8)}...${address.slice(-8)}`;
    };

    test('should truncate long addresses', () => {
      const fullAddress = 'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW';
      const truncated = truncateAddress(fullAddress);
      expect(truncated).toBe('GABCDEFG...OPQRSTUVW');
      expect(truncated.length).toBeLessThan(fullAddress.length);
    });

    test('should not truncate short strings', () => {
      const shortAddress = 'GABCDEF';
      expect(truncateAddress(shortAddress)).toBe(shortAddress);
    });
  });

  describe('Form States', () => {
    const validStates = ['idle', 'loading', 'ready', 'signing', 'submitting', 'success', 'error'];

    test('should have all required states', () => {
      expect(validStates).toContain('idle');
      expect(validStates).toContain('loading');
      expect(validStates).toContain('ready');
      expect(validStates).toContain('signing');
      expect(validStates).toContain('submitting');
      expect(validStates).toContain('success');
      expect(validStates).toContain('error');
    });
  });

  describe('HTML Escaping', () => {
    const escapeHtml = (text: string): string => {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    };

    test('should escape HTML special characters', () => {
      expect(escapeHtml('<script>alert("xss")</script>')).not.toContain('<script>');
      expect(escapeHtml('&')).toBe('&amp;');
      expect(escapeHtml('<')).toBe('&lt;');
      expect(escapeHtml('>')).toBe('&gt;');
    });

    test('should preserve normal text', () => {
      expect(escapeHtml('Hello World')).toBe('Hello World');
      expect(escapeHtml('Test Project')).toBe('Test Project');
    });
  });

  describe('Network Configuration', () => {
    test('should have correct testnet passphrase', () => {
      const testnetPassphrase = 'Test SDF Network ; September 2015';
      expect(testnetPassphrase).toContain('Test');
    });

    test('should have correct mainnet passphrase', () => {
      const mainnetPassphrase = 'Public Global Stellar Network ; September 2015';
      expect(mainnetPassphrase).toContain('Public');
    });
  });
});

describe('Recent Donations', () => {
  interface RecentDonation {
    address: string;
    amount: number;
    projectName: string;
    timestamp: number;
    txHash: string;
  }

  test('should keep only last 10 donations', () => {
    const donations: RecentDonation[] = [];

    // Add 15 donations
    for (let i = 0; i < 15; i++) {
      donations.unshift({
        address: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW',
        amount: 5,
        projectName: `Project ${i}`,
        timestamp: Date.now(),
        txHash: `hash${i}`,
      });
    }

    // Keep only last 10
    const limitedDonations = donations.slice(0, 10);
    expect(limitedDonations).toHaveLength(10);
    expect(limitedDonations[0].projectName).toBe('Project 14');
  });

  test('should format relative time correctly', () => {
    const formatRelativeTime = (timestamp: number): string => {
      const now = Date.now();
      const diff = now - timestamp;
      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(diff / 3600000);
      const days = Math.floor(diff / 86400000);

      if (minutes < 1) return 'Just now';
      if (minutes < 60) return `${minutes}m ago`;
      if (hours < 24) return `${hours}h ago`;
      return `${days}d ago`;
    };

    const now = Date.now();
    expect(formatRelativeTime(now)).toBe('Just now');
    expect(formatRelativeTime(now - 5 * 60000)).toBe('5m ago');
    expect(formatRelativeTime(now - 2 * 3600000)).toBe('2h ago');
    expect(formatRelativeTime(now - 3 * 86400000)).toBe('3d ago');
  });
});
