import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

// Mock AuthContext to control login behavior per test
jest.mock('../../context/AuthContext', () => ({
  __esModule: true,
  useAuth: jest.fn(),
}));

// expo-router is mocked in jest.setup.ts; no extra here

// Import after mocks
import SignInScreen from '../../app/(root)/sign-in';
import { useAuth } from '../../context/AuthContext';

const mockUseAuth = useAuth as jest.Mock;

describe('SignInScreen (logging)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows validation errors when fields are empty', async () => {
    mockUseAuth.mockReturnValue({ login: jest.fn() });
    const { getByText } = render(<SignInScreen />);

    fireEvent.press(getByText('Log In'));

    await waitFor(() => {
      expect(getByText('Email is required')).toBeTruthy();
      expect(getByText('Password is required')).toBeTruthy();
    });
  });

  it('calls login and logs success on valid credentials', async () => {
    const login = jest.fn().mockResolvedValue({ email: 'test@example.com', role: 'patient' });
    mockUseAuth.mockReturnValue({ login });
    const { getByPlaceholderText, getByText } = render(<SignInScreen />);

    fireEvent.changeText(getByPlaceholderText('Enter your email'), 'test@example.com');
    fireEvent.changeText(getByPlaceholderText('Enter your password'), 'password123');

    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    fireEvent.press(getByText('Log In'));

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith('test@example.com', 'password123');
      expect(logSpy).toHaveBeenCalled();
    });

    logSpy.mockRestore();
  });

  it('alerts on login failure and logs error details', async () => {
    const error = { response: { data: { message: 'Invalid credentials' }, status: 401 } } as any;
    const login = jest.fn().mockRejectedValue(error);
    mockUseAuth.mockReturnValue({ login });
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const { getByPlaceholderText, getByText } = render(<SignInScreen />);

    fireEvent.changeText(getByPlaceholderText('Enter your email'), 'test@example.com');
    fireEvent.changeText(getByPlaceholderText('Enter your password'), 'wrong');

    fireEvent.press(getByText('Log In'));

    await waitFor(() => {
      expect(login).toHaveBeenCalled();
      expect(alertSpy).toHaveBeenCalledWith('Login Failed', 'Invalid credentials');
      expect(errSpy).toHaveBeenCalled();
    });

    alertSpy.mockRestore();
    errSpy.mockRestore();
  });
});
