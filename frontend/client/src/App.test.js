import { render, screen } from '@testing-library/react';
import App from './App';

test('renders app header branding', () => {
  render(<App />);
  expect(screen.getByText(/aegis trading/i)).toBeInTheDocument();
});
