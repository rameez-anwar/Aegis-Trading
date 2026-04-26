import { render, screen } from '@testing-library/react';
import App from './App';

test('renders trading strategies heading', () => {
  render(<App />);
  expect(screen.getByText(/aegis trading/i)).toBeInTheDocument();
});
