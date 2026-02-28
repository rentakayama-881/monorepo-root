import { render } from '@testing-library/react';
import { UserProvider } from '@/lib/UserContext';
import { ThemeProvider } from '@/lib/ThemeContext';

/**
 * Custom render that wraps components with required providers.
 * Use this instead of raw render() from @testing-library/react.
 */
export function renderWithProviders(ui, options = {}) {
  const { user = null, theme = 'light', ...renderOptions } = options;

  function Wrapper({ children }) {
    return (
      <ThemeProvider initialTheme={theme}>
        <UserProvider initialUser={user}>
          {children}
        </UserProvider>
      </ThemeProvider>
    );
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions });
}

/**
 * Create a mock API response for testing.
 */
export function mockApiResponse(data, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  });
}

/**
 * Create a mock error API response.
 */
export function mockApiError(message, status = 400) {
  return Promise.resolve({
    ok: false,
    status,
    json: () => Promise.resolve({ error: message }),
    text: () => Promise.resolve(JSON.stringify({ error: message })),
  });
}

export { render };
